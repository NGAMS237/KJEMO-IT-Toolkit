/**
 * procedures-windows.mjs — KJEMO-UX-MEMO-WINDOWS-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Fiches TÂCHE Windows à COMMANDE DIRECTE, du même format que les fiches
 * Linux de l'aide-mémoire : un formulaire de valeurs, la commande PowerShell
 * (ou CMD) prête à copier, la vérification, le retour arrière.
 *
 * Elles prolongent les assistants complets existants (`assistant: '…'`), qui
 * restent la voie guidée : formulaire, validations, script .ps1 complet.
 * Sans elles, l'aide-mémoire Windows ne proposait que des assistants, où l'on
 * ne voit pas la commande.
 *
 * Contrat identique aux autres fiches (vérifié par test/taches.test.mjs) :
 * aucune invite dans la commande, paramètres déclarés et validés, une
 * vérification par méthode, sources HTTPS. AUCUN mot de passe n'est saisi
 * dans le navigateur : la commande le demande à PowerShell (Read-Host
 * -AsSecureString ou Get-Credential), donc il ne figure ni à l'écran ni dans
 * l'historique. Rien n'est exécuté par le Toolkit ; rien n'a été lancé sur un
 * contrôleur de domaine réel.
 */

const MS = 'https://learn.microsoft.com';
const V_DOC = 'Commandes rédigées d’après la documentation Microsoft (liens des sources, à ouvrir pour confirmer la syntaxe de ta version) ; non exécutées sur un contrôleur de domaine, un serveur ou un poste réel.';
const RSAT = 'Module ActiveDirectory (outils RSAT ou contrôleur de domaine), console PowerShell ouverte en tant qu’administrateur du domaine.';

const ps = (cmd) => ({ invite: 'PS>', cmd });
const cmdw = (cmd) => ({ invite: '>', cmd });
const lec = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'lecture', explication, lignes, attendu, ...extra });
const mod = (titre, explication, lignes, attendu, extra = {}) => ({ titre, effet: 'modification', explication, lignes, attendu, ...extra });
const src = (label, chemin) => ({ label, url: `${MS}${chemin}` });

// Paramètres réutilisés
const OU = { id: 'ou', label: 'chemin (DN) de l’unité d’organisation', type: 'dn', exemple: 'OU=Ventes,DC=lab,DC=local', aide: 'Une OU se note OU=Nom,DC=domaine,DC=extension. Pour voir celles qui existent, utilise la fiche « Voir les unités d’organisation ».' };
const COMPTE = { id: 'compte', label: 'nom de connexion (SamAccountName)', type: 'identifiant', exemple: 'jdupont', aide: 'Le nom de connexion court de l’utilisateur.' };
const GROUPE = { id: 'groupe', label: 'nom du groupe', type: 'identifiant', exemple: 'Ventes_G', aide: 'Le nom court du groupe, sans espace.' };
const DOMAINE = { id: 'domaine', label: 'nom du domaine', type: 'fqdn', exemple: 'lab.local', aide: 'Le nom DNS du domaine, par exemple lab.local.' };
const RESEAU = { id: 'reseau', label: 'adresse du réseau (étendue DHCP)', type: 'ipv4', exemple: '192.168.1.0', aide: 'L’adresse du réseau de l’étendue, terminée par .0 pour un /24.' };
const CHEMIN = { id: 'chemin', label: 'dossier à partager', type: 'cheminWin', exemple: 'C:\\Partages\\Ventes', aide: 'Un chemin simple, sans espace.' };
const PRINCIPAL = { id: 'principal', label: 'groupe ou compte', type: 'principal', exemple: 'LAB\\Ventes_G', aide: 'DOMAINE\\nom pour un compte du domaine, ou simplement le nom pour un compte local.' };
const PARTAGE = { id: 'partage', label: 'nom du partage', type: 'identifiant', exemple: 'Ventes', aide: 'Le nom sous lequel le dossier apparaît sur le réseau.' };
const ZONE = { id: 'zone', label: 'nom de la zone DNS', type: 'fqdn', exemple: 'lab.local', aide: 'Le nom DNS de la zone, par exemple lab.local.' };
const IP = (id, label, exemple) => ({ id, label, type: 'ipv4', exemple });

/** Construit une fiche à UNE méthode console (powershell par défaut). */
function fiche({ id, titre, categorie, resume, effet, intentions, motsCles, params = [], methode = 'powershell', privileges, etapes, verification, retour = null, assistant, sources }) {
  return {
    id, titre, categorie, resume, effet, intentions, motsCles, params,
    origine: 'memo', // trouvable par la recherche, le catalogue et l'aide-mémoire ; absent des « tâches courantes » de l'accueil
    methodes: [{ id: methode, privileges, etapes, verification, retour }],
    assistant, sources, validation: V_DOC,
  };
}

export const PROCEDURES_WINDOWS = [
  // =========================================================================
  // ACTIVE DIRECTORY
  // =========================================================================
  fiche({
    id: 'win-ad-voir-ou', titre: 'Voir les unités d’organisation du domaine', categorie: 'Active Directory',
    resume: 'Liste les unités d’organisation (OU) du domaine avec leur chemin complet (DN), et montre le contenu d’une OU. Lecture seule ; c’est la première lecture avant de créer un compte ou de déplacer un objet.',
    effet: 'lecture',
    intentions: ['voir les unités d’organisation', 'liste des ou', 'get-adorganizationalunit', 'trouver le dn d’une ou', 'contenu d’une ou'],
    motsCles: ['active directory', 'ou', 'unité d’organisation', 'get-adorganizationalunit', 'dn', 'get-addomain'],
    params: [{ ...OU, id: 'parent', label: 'chemin (DN) de l’OU ou du domaine à explorer', exemple: 'DC=lab,DC=local' }],
    privileges: RSAT,
    etapes: [
      lec('Lire le nom (DN) du domaine', 'Le DN du domaine est la racine de tous les chemins : DC=lab,DC=local, par exemple.', [ps('Get-ADDomain | Select-Object DNSRoot, DistinguishedName')], 'DNSRoot : lab.local et DistinguishedName : DC=lab,DC=local.'),
      lec('Lister les unités d’organisation', 'Une ligne par OU, avec son chemin complet : c’est ce chemin qu’on donne aux autres fiches.', [ps('Get-ADOrganizationalUnit -Filter * | Select-Object Name, DistinguishedName | Sort-Object DistinguishedName')], 'Une ligne par OU. Aucune ligne : le domaine n’a encore aucune OU créée par l’administrateur.'),
      lec('Voir le contenu d’une OU', 'Liste ce qui se trouve directement dans l’OU ou à la racine du domaine : comptes, groupes, ordinateurs, sous-OU.', [ps('Get-ADObject -Filter * -SearchBase "{{parent}}" -SearchScope OneLevel | Select-Object Name, ObjectClass')], 'Une ligne par objet, avec sa classe (user, group, computer, organizationalUnit).', { verification: true }),
    ],
    verification: ['Les OU attendues figurent dans la liste avec le bon chemin.'],
    assistant: 'ad-ou-hierarchy',
    sources: [src('Get-ADOrganizationalUnit', '/powershell/module/activedirectory/get-adorganizationalunit'), src('Get-ADDomain', '/powershell/module/activedirectory/get-addomain'), src('Get-ADObject', '/powershell/module/activedirectory/get-adobject')],
  }),
  fiche({
    id: 'win-ad-creer-ou', titre: 'Créer une unité d’organisation (OU)', categorie: 'Active Directory',
    resume: 'Crée une OU dans le domaine pour y ranger des comptes, des groupes ou des ordinateurs. Elle est protégée contre la suppression accidentelle. Se défait, mais seulement après avoir levé la protection.',
    effet: 'modification',
    intentions: ['créer une ou', 'créer une unité d’organisation', 'new-adorganizationalunit', 'ajouter une ou dans active directory', 'créer un dossier dans active directory'],
    motsCles: ['active directory', 'ou', 'unité d’organisation', 'new-adorganizationalunit', 'créer', 'dn'],
    params: [
      { id: 'ou', label: 'nom de l’unité d’organisation', type: 'nom', exemple: 'Ventes', aide: 'Le nom de l’OU à créer, par exemple Ventes.' },
      { id: 'parent', label: 'où la créer (DN du domaine ou d’une OU)', type: 'dn', exemple: 'DC=lab,DC=local', aide: 'DC=lab,DC=local pour la racine du domaine. Get-ADDomain donne le tien.' },
    ],
    privileges: RSAT,
    etapes: [
      lec('Lire le nom (DN) du domaine', 'Le DN du domaine se met dans « où la créer » pour créer l’OU à la racine.', [ps('Get-ADDomain | Select-Object DNSRoot, DistinguishedName')], 'DistinguishedName : DC=lab,DC=local (le tien peut différer).'),
      mod('Créer l’OU', 'Crée l’unité d’organisation à l’endroit indiqué, protégée contre la suppression accidentelle.', [ps('New-ADOrganizationalUnit -Name "{{ou}}" -Path "{{parent}}" -ProtectedFromAccidentalDeletion $true')], 'Aucun message en cas de succès. Une erreur « existe déjà » signifie que l’OU est déjà là.', { important: 'La protection est activée : pour supprimer cette OU un jour, il faudra d’abord la lever (voir « retour arrière »).' }),
      lec('Vérifier', 'Relit l’OU créée et son chemin complet.', [ps('Get-ADOrganizationalUnit -Filter \'Name -eq "{{ou}}"\' | Select-Object Name, DistinguishedName')], 'Une ligne avec Name : Ventes et le DistinguishedName attendu.', { verification: true }),
    ],
    verification: ['L’OU apparaît avec le bon chemin (DistinguishedName).'],
    retour: 'Lever la protection (Set-ADOrganizationalUnit -Identity "OU=…" -ProtectedFromAccidentalDeletion $false) puis supprimer l’OU (Remove-ADOrganizationalUnit -Identity "OU=…"), seulement si elle est vide.',
    assistant: 'ad-ou',
    sources: [src('New-ADOrganizationalUnit', '/powershell/module/activedirectory/new-adorganizationalunit'), src('Get-ADOrganizationalUnit', '/powershell/module/activedirectory/get-adorganizationalunit')],
  }),
  fiche({
    id: 'win-ad-creer-utilisateur', titre: 'Créer un utilisateur Active Directory', categorie: 'Active Directory',
    resume: 'Crée un compte utilisateur dans une OU, avec un mot de passe provisoire demandé par PowerShell (jamais écrit dans la commande) et un changement obligatoire à la première ouverture de session.',
    effet: 'modification',
    intentions: ['créer un utilisateur active directory', 'new-aduser', 'ajouter un compte au domaine', 'créer un compte ad', 'nouvel utilisateur du domaine'],
    motsCles: ['active directory', 'utilisateur', 'compte', 'new-aduser', 'créer', 'domaine'],
    params: [
      { id: 'nom', label: 'nom complet affiché', type: 'nom', exemple: 'Jean Dupont', aide: 'Prénom et nom, tels qu’ils apparaîtront dans l’annuaire.' },
      COMPTE, DOMAINE, OU,
    ],
    privileges: RSAT,
    etapes: [
      lec('Confirmer que l’OU existe', 'On ne crée pas un compte dans une OU qui n’existe pas : cette lecture la retrouve.', [ps('Get-ADOrganizationalUnit -Identity "{{ou}}" | Select-Object Name, DistinguishedName')], 'Une ligne avec le nom de l’OU. Une erreur « introuvable » : corrige le chemin ou crée d’abord l’OU.'),
      mod('Créer le compte', 'PowerShell te demande le mot de passe provisoire (saisie masquée) : il ne s’affiche pas et n’entre pas dans l’historique. Il doit respecter la politique de mot de passe du domaine.', [ps('New-ADUser -Name "{{nom}}" -SamAccountName {{compte}} -UserPrincipalName {{compte}}@{{domaine}} -Path "{{ou}}" -AccountPassword (Read-Host -AsSecureString "Mot de passe provisoire") -ChangePasswordAtLogon $true -Enabled $true')], 'Une invite « Mot de passe provisoire : », puis aucun message en cas de succès. Une erreur « ne respecte pas les exigences » : le mot de passe est trop faible.', { important: 'Communique le mot de passe provisoire à l’utilisateur par un autre canal ; il devra le changer à sa première ouverture de session.' }),
      lec('Vérifier', 'Relit le compte : il doit être activé et se trouver dans la bonne OU.', [ps('Get-ADUser -Identity {{compte}} -Properties Enabled | Select-Object Name, SamAccountName, Enabled, DistinguishedName')], 'Enabled : True et un DistinguishedName qui se termine par le chemin de l’OU.', { verification: true }),
    ],
    verification: ['Le compte existe, Enabled vaut True, et il est dans la bonne OU.'],
    retour: 'Remove-ADUser -Identity (nom de connexion) supprime le compte après confirmation ; la suppression est définitive. Pour un usage temporaire, désactive plutôt le compte (fiche « Désactiver un compte »).',
    assistant: 'ad-user',
    sources: [src('New-ADUser', '/powershell/module/activedirectory/new-aduser'), src('Get-ADUser', '/powershell/module/activedirectory/get-aduser'), src('Read-Host', '/powershell/module/microsoft.powershell.utility/read-host')],
  }),
  fiche({
    id: 'win-ad-voir-utilisateurs', titre: 'Voir les utilisateurs du domaine', categorie: 'Active Directory',
    resume: 'Liste les comptes du domaine, puis ceux qui sont désactivés ou verrouillés. Lecture seule.',
    effet: 'lecture',
    intentions: ['voir les utilisateurs active directory', 'liste des comptes du domaine', 'get-aduser', 'comptes désactivés', 'comptes verrouillés'],
    motsCles: ['active directory', 'utilisateur', 'get-aduser', 'search-adaccount', 'verrouillé', 'désactivé'],
    privileges: RSAT,
    etapes: [
      lec('Lister les comptes', 'Une ligne par compte, avec son nom de connexion et son état.', [ps('Get-ADUser -Filter * -Properties Enabled | Select-Object Name, SamAccountName, Enabled')], 'Une ligne par compte (Administrateur, Invité, krbtgt et les comptes créés).'),
      lec('Lister les comptes désactivés', 'Les comptes qui ne peuvent plus ouvrir de session.', [ps('Search-ADAccount -AccountDisabled -UsersOnly | Select-Object Name, SamAccountName')], 'Les comptes désactivés ; aucune ligne si tout est actif (Invité et krbtgt le sont souvent).'),
      lec('Lister les comptes verrouillés', 'Les comptes bloqués après trop d’erreurs de mot de passe.', [ps('Search-ADAccount -LockedOut | Select-Object Name, SamAccountName')], 'Aucune ligne si personne n’est verrouillé. Pour déverrouiller : fiche « Débloquer un compte Active Directory ».', { verification: true }),
    ],
    verification: ['Les comptes attendus apparaissent et leur état est celui que tu pensais.'],
    assistant: 'ad-object-search-move',
    sources: [src('Get-ADUser', '/powershell/module/activedirectory/get-aduser'), src('Search-ADAccount', '/powershell/module/activedirectory/search-adaccount')],
  }),
  fiche({
    id: 'win-ad-creer-groupe', titre: 'Créer un groupe Active Directory', categorie: 'Active Directory',
    resume: 'Crée un groupe de sécurité global dans une OU, prêt à recevoir des membres et à servir dans des droits de partage ou des GPO.',
    effet: 'modification',
    intentions: ['créer un groupe active directory', 'new-adgroup', 'ajouter un groupe au domaine', 'groupe de sécurité global', 'créer un groupe ad'],
    motsCles: ['active directory', 'groupe', 'new-adgroup', 'sécurité', 'global', 'créer'],
    params: [GROUPE, OU],
    privileges: RSAT,
    etapes: [
      mod('Créer le groupe', 'Un groupe de sécurité de portée globale : le type habituel pour regrouper des utilisateurs d’un même service.', [ps('New-ADGroup -Name {{groupe}} -GroupScope Global -GroupCategory Security -Path "{{ou}}"')], 'Aucun message en cas de succès. Une erreur « existe déjà » : le groupe est déjà là.'),
      lec('Vérifier', 'Relit le groupe créé, avec sa portée et son chemin.', [ps('Get-ADGroup -Identity {{groupe}} | Select-Object Name, GroupScope, GroupCategory, DistinguishedName')], 'GroupScope : Global, GroupCategory : Security et le bon DistinguishedName.', { verification: true }),
    ],
    verification: ['Le groupe existe, en portée Global et de catégorie Security.'],
    retour: 'Remove-ADGroup -Identity (nom du groupe) supprime le groupe après confirmation ; ses membres ne sont pas supprimés.',
    assistant: 'ad-groups',
    sources: [src('New-ADGroup', '/powershell/module/activedirectory/new-adgroup'), src('Get-ADGroup', '/powershell/module/activedirectory/get-adgroup')],
  }),
  fiche({
    id: 'win-ad-ajouter-membre', titre: 'Ajouter un utilisateur à un groupe Active Directory', categorie: 'Active Directory',
    resume: 'Ajoute un compte comme membre d’un groupe, puis affiche les membres du groupe. Se défait avec Remove-ADGroupMember.',
    effet: 'modification',
    intentions: ['ajouter un utilisateur à un groupe', 'add-adgroupmember', 'mettre un compte dans un groupe', 'membres d’un groupe ad', 'ajouter un membre au groupe'],
    motsCles: ['active directory', 'groupe', 'membre', 'add-adgroupmember', 'get-adgroupmember', 'utilisateur'],
    params: [GROUPE, COMPTE],
    privileges: RSAT,
    etapes: [
      mod('Ajouter le compte au groupe', 'Le compte devient membre du groupe ; ses droits s’appliquent à sa prochaine ouverture de session.', [ps('Add-ADGroupMember -Identity {{groupe}} -Members {{compte}}')], 'Aucun message en cas de succès. Une erreur « introuvable » : vérifie l’orthographe du groupe et du compte.'),
      lec('Vérifier les membres du groupe', 'Liste les membres : le compte doit y figurer.', [ps('Get-ADGroupMember -Identity {{groupe}} | Select-Object Name, SamAccountName')], 'Une ligne par membre, dont le compte ajouté.', { verification: true }),
    ],
    verification: ['Le compte figure dans la liste des membres du groupe.'],
    retour: 'Remove-ADGroupMember -Identity (groupe) -Members (compte) retire le compte du groupe après confirmation.',
    assistant: 'ad-group-members-csv',
    sources: [src('Add-ADGroupMember', '/powershell/module/activedirectory/add-adgroupmember'), src('Get-ADGroupMember', '/powershell/module/activedirectory/get-adgroupmember')],
  }),
  fiche({
    id: 'win-ad-reinit-mot-de-passe', titre: 'Réinitialiser le mot de passe d’un compte Active Directory', categorie: 'Active Directory',
    resume: 'Remplace le mot de passe d’un compte par un mot de passe provisoire demandé par PowerShell, et impose son changement à la prochaine ouverture de session. Ne se défait pas : l’ancien mot de passe est perdu.',
    effet: 'modification',
    intentions: ['réinitialiser un mot de passe active directory', 'set-adaccountpassword', 'mot de passe oublié domaine', 'changer le mot de passe d’un utilisateur', 'reset password ad'],
    motsCles: ['active directory', 'mot de passe', 'set-adaccountpassword', 'réinitialiser', 'compte', 'reset'],
    params: [COMPTE],
    privileges: `${RSAT} Droit délégué de réinitialiser les mots de passe.`,
    etapes: [
      mod('Définir le mot de passe provisoire', 'PowerShell demande le nouveau mot de passe (saisie masquée) : il n’apparaît ni à l’écran ni dans l’historique. Il doit respecter la politique du domaine.', [ps('Set-ADAccountPassword -Identity {{compte}} -Reset -NewPassword (Read-Host -AsSecureString "Nouveau mot de passe")')], 'Une invite « Nouveau mot de passe : », puis aucun message en cas de succès.', { important: 'Communique le mot de passe provisoire par un autre canal que le courriel de l’utilisateur concerné.' }),
      mod('Imposer le changement à la prochaine ouverture', 'Pour que seul l’utilisateur connaisse son mot de passe définitif.', [ps('Set-ADUser -Identity {{compte}} -ChangePasswordAtLogon $true')], 'Aucun message en cas de succès.'),
      lec('Vérifier', 'Relit la date du dernier changement et l’état de verrouillage du compte.', [ps('Get-ADUser -Identity {{compte}} -Properties PasswordLastSet, LockedOut | Select-Object SamAccountName, PasswordLastSet, LockedOut')], 'PasswordLastSet : la date du jour. Si LockedOut vaut True, déverrouille aussi le compte (fiche « Débloquer un compte Active Directory »).', { verification: true }),
    ],
    verification: ['PasswordLastSet est la date du jour et l’utilisateur peut ouvrir une session avec le mot de passe provisoire.'],
    retour: 'Aucun retour possible : l’ancien mot de passe n’est pas récupérable. Réinitialise de nouveau si besoin.',
    assistant: 'ad-account-recovery',
    sources: [src('Set-ADAccountPassword', '/powershell/module/activedirectory/set-adaccountpassword'), src('Set-ADUser', '/powershell/module/activedirectory/set-aduser')],
  }),
  fiche({
    id: 'win-ad-desactiver-compte', titre: 'Désactiver un compte Active Directory', categorie: 'Active Directory',
    resume: 'Empêche un compte d’ouvrir une session sans le supprimer : c’est le bon geste quand une personne quitte l’organisation ou qu’un compte est suspect. Se défait avec Enable-ADAccount.',
    effet: 'modification',
    intentions: ['désactiver un compte active directory', 'disable-adaccount', 'bloquer un compte utilisateur', 'désactiver un utilisateur', 'réactiver un compte'],
    motsCles: ['active directory', 'compte', 'désactiver', 'disable-adaccount', 'enable-adaccount', 'utilisateur'],
    params: [COMPTE],
    privileges: RSAT,
    etapes: [
      lec('Lire l’état du compte', 'Enabled doit valoir True avant la désactivation.', [ps('Get-ADUser -Identity {{compte}} -Properties Enabled | Select-Object SamAccountName, Enabled')], 'Enabled : True.'),
      mod('Désactiver le compte', 'Le compte reste dans l’annuaire avec ses groupes et ses données, mais ne peut plus se connecter.', [ps('Disable-ADAccount -Identity {{compte}}')], 'Aucun message en cas de succès.', { important: 'Une session déjà ouverte peut continuer jusqu’à son expiration ou jusqu’à la prochaine demande d’authentification.' }),
      lec('Vérifier', 'Enabled doit être passé à False.', [ps('Get-ADUser -Identity {{compte}} -Properties Enabled | Select-Object SamAccountName, Enabled')], 'Enabled : False.', { verification: true }),
    ],
    verification: ['Enabled vaut False.'],
    retour: 'Enable-ADAccount -Identity (nom de connexion) réactive le compte.',
    assistant: 'ad-account-recovery',
    sources: [src('Disable-ADAccount', '/powershell/module/activedirectory/disable-adaccount'), src('Enable-ADAccount', '/powershell/module/activedirectory/enable-adaccount')],
  }),
  fiche({
    id: 'win-ad-deplacer-objet', titre: 'Déplacer un utilisateur vers une autre OU', categorie: 'Active Directory',
    resume: 'Déplace un compte utilisateur d’une unité d’organisation vers une autre. Les stratégies de groupe liées à la nouvelle OU s’appliqueront à lui. Se défait en le redéplaçant.',
    effet: 'modification',
    intentions: ['déplacer un utilisateur vers une ou', 'move-adobject', 'changer l’ou d’un compte', 'déplacer un objet active directory', 'ranger un compte dans une ou'],
    motsCles: ['active directory', 'ou', 'déplacer', 'move-adobject', 'utilisateur', 'compte'],
    params: [COMPTE, { ...OU, label: 'OU de destination (DN)' }],
    privileges: RSAT,
    etapes: [
      lec('Voir où se trouve le compte', 'Le DistinguishedName montre l’OU actuelle : note-la pour pouvoir revenir en arrière.', [ps('Get-ADUser -Identity {{compte}} | Select-Object SamAccountName, DistinguishedName')], 'Un DistinguishedName comme CN=Jean Dupont,OU=Accueil,DC=lab,DC=local.'),
      mod('Déplacer le compte', 'Get-ADUser retrouve le compte et Move-ADObject le dépose dans l’OU de destination.', [ps('Get-ADUser -Identity {{compte}} | Move-ADObject -TargetPath "{{ou}}"')], 'Aucun message en cas de succès.', { important: 'Les GPO de la nouvelle OU s’appliqueront à l’utilisateur à sa prochaine ouverture de session.' }),
      lec('Vérifier', 'Le DistinguishedName doit maintenant se terminer par le chemin de la nouvelle OU.', [ps('Get-ADUser -Identity {{compte}} | Select-Object SamAccountName, DistinguishedName')], 'Un DistinguishedName qui se termine par le chemin de l’OU de destination.', { verification: true }),
    ],
    verification: ['Le compte est dans l’OU de destination.'],
    retour: 'Redéplace le compte avec la même commande, en prenant pour destination l’OU notée à la première étape.',
    assistant: 'ad-object-search-move',
    sources: [src('Move-ADObject', '/powershell/module/activedirectory/move-adobject'), src('Get-ADUser', '/powershell/module/activedirectory/get-aduser')],
  }),
  fiche({
    id: 'win-ad-joindre-domaine', titre: 'Joindre un poste Windows au domaine', categorie: 'Poste de travail Windows',
    resume: 'Vérifie que le poste trouve le domaine, l’y joint avec un compte autorisé (demandé dans une fenêtre, jamais écrit dans la commande), puis redémarre. Se défait avec Remove-Computer.',
    effet: 'interruption',
    intentions: ['joindre un poste au domaine', 'add-computer', 'ajouter un ordinateur au domaine', 'joindre windows au domaine active directory', 'rejoindre le domaine'],
    motsCles: ['domaine', 'jonction', 'add-computer', 'poste windows', 'active directory', 'ordinateur'],
    params: [DOMAINE],
    privileges: 'PowerShell ouvert en tant qu’administrateur local du poste ; un compte du domaine autorisé à joindre des ordinateurs ; le DNS du poste doit pointer vers le contrôleur de domaine.',
    etapes: [
      lec('Vérifier que le poste trouve le domaine', 'Si le nom du domaine ne se résout pas, le DNS du poste ne pointe pas vers le contrôleur de domaine : la jonction échouerait.', [ps('Resolve-DnsName {{domaine}}')], 'Une ou plusieurs adresses du contrôleur de domaine. Une erreur « DNS name does not exist » : corrige le DNS de la carte réseau avant de continuer.'),
      mod('Joindre le poste au domaine', 'Une fenêtre demande le nom et le mot de passe du compte du domaine autorisé : ils ne passent pas par la commande.', [ps('Add-Computer -DomainName {{domaine}} -Credential (Get-Credential)')], 'Une fenêtre d’identifiants, puis un avertissement indiquant qu’un redémarrage est nécessaire. Une erreur « compte spécifié déjà existant » : l’ordinateur existe déjà dans l’annuaire.'),
      { titre: 'Redémarrer le poste', effet: 'interruption', explication: 'La jonction ne prend effet qu’après le redémarrage. Enregistre ton travail avant.', lignes: [ps('Restart-Computer')], attendu: 'Le poste redémarre ; l’écran de connexion propose le domaine.' },
      lec('Vérifier la jonction', 'Après le redémarrage, le poste doit annoncer le domaine.', [ps('(Get-CimInstance Win32_ComputerSystem).Domain')], 'Le nom du domaine (lab.local), et non WORKGROUP.', { verification: true }),
    ],
    verification: ['Le poste affiche le domaine et un compte du domaine peut ouvrir une session.'],
    retour: 'Remove-Computer -UnjoinDomainCredential (Get-Credential) -WorkgroupName WORKGROUP -Restart sort le poste du domaine (le compte ordinateur reste dans l’annuaire jusqu’à son nettoyage).',
    assistant: 'windows-domain-join',
    sources: [src('Add-Computer', '/powershell/module/microsoft.powershell.management/add-computer'), src('Resolve-DnsName', '/powershell/module/dnsclient/resolve-dnsname'), src('Get-Credential', '/powershell/module/microsoft.powershell.security/get-credential')],
  }),

  // =========================================================================
  // STRATÉGIES DE GROUPE (GPO)
  // =========================================================================
  fiche({
    id: 'win-gpo-lister', titre: 'Lister les GPO du domaine', categorie: 'GPO',
    resume: 'Liste les stratégies de groupe (GPO) du domaine avec leur état et leur dernière modification. Lecture seule.',
    effet: 'lecture',
    intentions: ['lister les gpo', 'get-gpo', 'voir les stratégies de groupe', 'quelles gpo existent', 'inventaire des gpo'],
    motsCles: ['gpo', 'stratégie de groupe', 'get-gpo', 'liste', 'domaine'],
    privileges: 'Module GroupPolicy (outils RSAT « Gestion des stratégies de groupe » ou contrôleur de domaine).',
    etapes: [
      lec('Lister les GPO', 'Une ligne par GPO, triée par nom.', [ps('Get-GPO -All | Select-Object DisplayName, GpoStatus, ModificationTime | Sort-Object DisplayName')], 'Au moins « Default Domain Policy » et « Default Domain Controllers Policy », plus tes propres GPO.', { verification: true }),
    ],
    verification: ['Les GPO attendues figurent dans la liste.'],
    assistant: 'gpo-inventory-report',
    sources: [src('Get-GPO', '/powershell/module/grouppolicy/get-gpo')],
  }),
  fiche({
    id: 'win-gpo-creer-lier', titre: 'Créer une GPO et la lier à une OU', categorie: 'GPO',
    resume: 'Crée une stratégie de groupe vide et la lie à une unité d’organisation. Les réglages s’ajoutent ensuite dans la console de gestion des stratégies de groupe. Se défait en supprimant le lien.',
    effet: 'modification',
    intentions: ['créer une gpo', 'new-gpo', 'lier une gpo à une ou', 'new-gplink', 'créer une stratégie de groupe'],
    motsCles: ['gpo', 'stratégie de groupe', 'new-gpo', 'new-gplink', 'lier', 'ou'],
    params: [{ id: 'gpo', label: 'nom de la GPO', type: 'nom', exemple: 'Bureau_Ventes', aide: 'Un nom clair qui dit à qui et à quoi elle sert.' }, OU],
    privileges: 'Module GroupPolicy et droit de créer et de lier des GPO (administrateur du domaine).',
    etapes: [
      mod('Créer la GPO', 'La GPO est créée vide : elle ne change encore rien.', [ps('New-GPO -Name "{{gpo}}"')], 'Un résumé de la GPO créée (DisplayName, Id, GpoStatus : AllSettingsEnabled).'),
      mod('Lier la GPO à l’OU', 'À partir de maintenant, la GPO s’applique aux comptes et aux ordinateurs de cette OU.', [ps('New-GPLink -Name "{{gpo}}" -Target "{{ou}}"')], 'Un résumé du lien (Enabled : True).', { important: 'Ajoute les réglages dans la GPO avant de la lier à une OU de production : une GPO vide ne fait rien, mais une GPO mal réglée touche tous les objets de l’OU.' }),
      lec('Vérifier le lien', 'Liste les GPO appliquées à l’OU.', [ps('Get-GPInheritance -Target "{{ou}}"')], 'La GPO apparaît dans GpoLinks, avec Enabled : True.', { verification: true }),
      lec('Régler la GPO', 'Les réglages (mots de passe, fond d’écran, lecteurs réseau…) se choisissent dans la console graphique.', [ps('gpmc.msc')], 'La console « Gestion des stratégies de groupe » s’ouvre : clic droit sur la GPO, **Modifier…**.', { facultatif: true }),
    ],
    verification: ['Get-GPInheritance montre la GPO liée à l’OU, avec Enabled : True.'],
    retour: 'Remove-GPLink -Name (nom de la GPO) -Target (chemin de l’OU) retire le lien ; Remove-GPO -Name (nom) supprime la GPO elle-même.',
    assistant: 'gpo-create-link',
    sources: [src('New-GPO', '/powershell/module/grouppolicy/new-gpo'), src('New-GPLink', '/powershell/module/grouppolicy/new-gplink'), src('Get-GPInheritance', '/powershell/module/grouppolicy/get-gpinheritance')],
  }),
  fiche({
    id: 'win-gpo-resultat', titre: 'Voir les GPO appliquées à un poste (gpresult)', categorie: 'GPO',
    resume: 'Affiche quelles stratégies de groupe s’appliquent à l’utilisateur et à l’ordinateur, et lesquelles ont été refusées. Lecture seule ; à lancer sur le poste concerné.',
    effet: 'lecture',
    intentions: ['gpresult', 'quelles gpo s’appliquent', 'voir les stratégies appliquées', 'gpo appliquée au poste', 'résultat de stratégie'],
    motsCles: ['gpo', 'gpresult', 'stratégie de groupe', 'appliquées', 'poste', 'résultat'],
    methode: 'cmd',
    privileges: 'Utilisateur ordinaire pour la partie utilisateur ; Invite de commandes en administrateur pour la partie ordinateur.',
    etapes: [
      lec('Résumé complet', 'Résume les GPO appliquées à l’ordinateur et à l’utilisateur connecté.', [cmdw('gpresult /r')], 'Deux sections (ordinateur et utilisateur) avec « Objets de stratégie de groupe appliqués » et, au besoin, « Objets de stratégie de groupe filtrés ».'),
      lec('Partie ordinateur seule', 'Montre seulement ce qui s’applique à la machine (à lancer en administrateur).', [cmdw('gpresult /scope computer /r')], 'La liste des GPO appliquées à l’ordinateur.', { verification: true }),
    ],
    verification: ['La GPO attendue figure dans les objets appliqués ; sinon, regarde la liste des objets filtrés et leur raison.'],
    assistant: 'gpo-resultant-set',
    sources: [src('gpresult', '/windows-server/administration/windows-commands/gpresult')],
  }),

  // =========================================================================
  // WINDOWS SERVER : DHCP
  // =========================================================================
  fiche({
    id: 'win-dhcp-installer', titre: 'Installer et autoriser un serveur DHCP', categorie: 'Windows Server',
    resume: 'Installe le rôle DHCP sur Windows Server puis l’autorise dans Active Directory : sans autorisation, un serveur DHCP de domaine ne distribue rien. Se défait en retirant le rôle.',
    effet: 'modification',
    intentions: ['installer le dhcp', 'install-windowsfeature dhcp', 'autoriser un serveur dhcp', 'add-dhcpserverindc', 'configurer un serveur dhcp'],
    motsCles: ['dhcp', 'windows server', 'installer', 'autoriser', 'add-dhcpserverindc', 'rôle'],
    params: [{ id: 'fqdn', label: 'nom complet du serveur', type: 'fqdn', exemple: 'srv1.lab.local', aide: 'Le nom DNS complet de ce serveur.' }, IP('ip', 'adresse IPv4 du serveur', '192.168.1.10')],
    privileges: 'Windows Server, PowerShell en administrateur ; compte membre des « Administrateurs de l’entreprise » pour l’autorisation dans l’annuaire.',
    etapes: [
      mod('Installer le rôle DHCP', 'Ajoute le rôle et sa console de gestion. L’installation peut durer une à deux minutes.', [ps('Install-WindowsFeature DHCP -IncludeManagementTools')], 'Success : True, avec le rôle DHCP et ses outils dans la liste des fonctionnalités installées.'),
      mod('Autoriser le serveur dans l’annuaire', 'Un serveur DHCP membre d’un domaine ne répond qu’une fois autorisé.', [ps('Add-DhcpServerInDC -DnsName {{fqdn}} -IPAddress {{ip}}')], 'Aucun message en cas de succès.', { important: 'Ces commandes agissent sur le serveur où tu les lances : vérifie le nom et l’adresse avant d’autoriser.' }),
      lec('Vérifier', 'Le serveur doit figurer dans la liste des serveurs DHCP autorisés, et son service doit tourner.', [ps('Get-DhcpServerInDC'), ps('Get-Service DHCPServer')], 'Le serveur dans la liste ; Status : Running.', { verification: true }),
    ],
    verification: ['Le serveur est dans la liste des serveurs autorisés et le service DHCPServer est Running.'],
    retour: 'Remove-DhcpServerInDC -DnsName (nom) -IPAddress (adresse) retire l’autorisation ; Uninstall-WindowsFeature DHCP retire le rôle.',
    assistant: 'dhcp-install-authorize',
    sources: [src('Install-WindowsFeature', '/powershell/module/servermanager/install-windowsfeature'), src('Add-DhcpServerInDC', '/powershell/module/dhcpserver/add-dhcpserverindc'), src('Get-DhcpServerInDC', '/powershell/module/dhcpserver/get-dhcpserverindc')],
  }),
  fiche({
    id: 'win-dhcp-etendue', titre: 'Créer une étendue DHCP et ses options', categorie: 'Windows Server',
    resume: 'Crée une étendue (plage d’adresses distribuées) puis règle la passerelle, le DNS et le domaine donnés aux clients. Se défait avec Remove-DhcpServerv4Scope.',
    effet: 'modification',
    intentions: ['créer une étendue dhcp', 'add-dhcpserverv4scope', 'plage d’adresses dhcp', 'options dhcp passerelle dns', 'configurer une étendue'],
    motsCles: ['dhcp', 'étendue', 'scope', 'add-dhcpserverv4scope', 'passerelle', 'dns', 'plage'],
    params: [
      { id: 'nom', label: 'nom de l’étendue', type: 'identifiant', exemple: 'LAN_Bureau', aide: 'Un nom court, sans espace.' },
      IP('debut', 'première adresse distribuée', '192.168.1.100'), IP('fin', 'dernière adresse distribuée', '192.168.1.200'),
      IP('masque', 'masque du réseau', '255.255.255.0'), RESEAU,
      IP('passerelle', 'adresse de la passerelle', '192.168.1.1'), IP('dns', 'adresse du serveur DNS', '192.168.1.10'), DOMAINE,
    ],
    privileges: 'Rôle DHCP installé et autorisé ; PowerShell en administrateur (ou membre du groupe « Administrateurs DHCP »).',
    etapes: [
      mod('Créer l’étendue', 'La plage d’adresses que le serveur distribuera aux clients. Elle doit se situer dans le réseau indiqué.', [ps('Add-DhcpServerv4Scope -Name "{{nom}}" -StartRange {{debut}} -EndRange {{fin}} -SubnetMask {{masque}} -State Active')], 'Aucun message en cas de succès.', { important: 'Ne fais pas chevaucher cette plage avec les adresses fixes du réseau (serveurs, imprimantes, passerelle).' }),
      mod('Régler les options distribuées aux clients', 'Chaque client reçoit en plus de son adresse : la passerelle, le serveur DNS et le suffixe du domaine.', [ps('Set-DhcpServerv4OptionValue -ScopeId {{reseau}} -Router {{passerelle}} -DnsServer {{dns}} -DnsDomain {{domaine}}')], 'Aucun message en cas de succès.'),
      lec('Vérifier l’étendue et ses options', 'L’étendue doit être Active et les options doivent porter les bonnes valeurs.', [ps('Get-DhcpServerv4Scope -ScopeId {{reseau}}'), ps('Get-DhcpServerv4OptionValue -ScopeId {{reseau}}')], 'State : Active, la plage attendue, puis les options Router, DnsServer et DnsDomain.', { verification: true }),
    ],
    verification: ['L’étendue est Active avec la bonne plage, et un client reçoit bien passerelle et DNS.'],
    retour: 'Remove-DhcpServerv4Scope -ScopeId (réseau) supprime l’étendue et ses baux.',
    assistant: 'dhcp-scope-options',
    sources: [src('Add-DhcpServerv4Scope', '/powershell/module/dhcpserver/add-dhcpserverv4scope'), src('Set-DhcpServerv4OptionValue', '/powershell/module/dhcpserver/set-dhcpserverv4optionvalue'), src('Get-DhcpServerv4Scope', '/powershell/module/dhcpserver/get-dhcpserverv4scope')],
  }),
  fiche({
    id: 'win-dhcp-reservation', titre: 'Créer une réservation DHCP', categorie: 'Windows Server',
    resume: 'Associe une adresse IP fixe à l’adresse MAC d’un appareil (imprimante, serveur) : il reçoit toujours la même adresse du DHCP. Se défait avec Remove-DhcpServerv4Reservation.',
    effet: 'modification',
    intentions: ['créer une réservation dhcp', 'add-dhcpserverv4reservation', 'adresse ip fixe par dhcp', 'réserver une adresse ip', 'réservation imprimante dhcp'],
    motsCles: ['dhcp', 'réservation', 'mac', 'add-dhcpserverv4reservation', 'adresse ip', 'imprimante'],
    params: [RESEAU, IP('ip', 'adresse à réserver', '192.168.1.50'),
      { id: 'mac', label: 'adresse MAC de l’appareil', type: 'mac', exemple: '00-15-5D-01-02-03', aide: 'Six paires séparées par des tirets (ipconfig /all, « Adresse physique »).' },
      { id: 'nom', label: 'nom de la réservation', type: 'identifiant', exemple: 'imprimante1', aide: 'Un nom court qui dit quel appareil.' }],
    privileges: 'Rôle DHCP installé ; PowerShell en administrateur ou membre de « Administrateurs DHCP ».',
    etapes: [
      mod('Créer la réservation', 'L’adresse réservée doit se trouver dans le réseau de l’étendue.', [ps('Add-DhcpServerv4Reservation -ScopeId {{reseau}} -IPAddress {{ip}} -ClientId {{mac}} -Name {{nom}}')], 'Aucun message en cas de succès. Une erreur « existe déjà » : l’adresse ou la MAC est déjà réservée.'),
      lec('Vérifier', 'Liste les réservations de l’étendue : la nouvelle doit y figurer.', [ps('Get-DhcpServerv4Reservation -ScopeId {{reseau}}')], 'Une ligne avec l’adresse, la MAC et le nom attendus.', { verification: true }),
    ],
    verification: ['La réservation figure dans la liste et l’appareil obtient son adresse après un renouvellement de bail.'],
    retour: 'Remove-DhcpServerv4Reservation -ScopeId (réseau) -IPAddress (adresse) supprime la réservation.',
    assistant: 'dhcp-reservation',
    sources: [src('Add-DhcpServerv4Reservation', '/powershell/module/dhcpserver/add-dhcpserverv4reservation'), src('Get-DhcpServerv4Reservation', '/powershell/module/dhcpserver/get-dhcpserverv4reservation')],
  }),
  fiche({
    id: 'win-dhcp-baux', titre: 'Voir les baux DHCP d’une étendue', categorie: 'Windows Server',
    resume: 'Liste les adresses actuellement distribuées par le serveur DHCP et l’usage de l’étendue. Lecture seule ; utile pour savoir qui a quelle adresse ou si la plage est pleine.',
    effet: 'lecture',
    intentions: ['voir les baux dhcp', 'get-dhcpserverv4lease', 'qui a quelle adresse ip', 'adresses distribuées par le dhcp', 'étendue dhcp pleine'],
    motsCles: ['dhcp', 'baux', 'lease', 'get-dhcpserverv4lease', 'étendue', 'adresses'],
    params: [RESEAU],
    privileges: 'Rôle DHCP (ou outils d’administration DHCP) ; lecture suffisante.',
    etapes: [
      lec('Lister les baux', 'Une ligne par adresse distribuée, avec le nom de l’appareil et la fin du bail.', [ps('Get-DhcpServerv4Lease -ScopeId {{reseau}} | Select-Object IPAddress, ClientId, HostName, LeaseExpiryTime')], 'Une ligne par client ; aucune ligne si personne n’a encore reçu d’adresse.'),
      lec('Voir l’usage de l’étendue', 'Adresses libres, utilisées, et pourcentage d’occupation.', [ps('Get-DhcpServerv4ScopeStatistics -ScopeId {{reseau}}')], 'Free, InUse et PercentageInUse : au-delà de 90 %, la plage risque de se vider.', { verification: true }),
    ],
    verification: ['Les baux attendus apparaissent et la plage n’est pas saturée.'],
    assistant: 'dhcp-leases-diagnostic',
    sources: [src('Get-DhcpServerv4Lease', '/powershell/module/dhcpserver/get-dhcpserverv4lease'), src('Get-DhcpServerv4ScopeStatistics', '/powershell/module/dhcpserver/get-dhcpserverv4scopestatistics')],
  }),

  // =========================================================================
  // WINDOWS SERVER : DNS
  // =========================================================================
  fiche({
    id: 'win-dns-zone-directe', titre: 'Créer une zone DNS directe', categorie: 'Windows Server',
    resume: 'Crée une zone qui traduit des noms en adresses (par exemple lab.local) sur un serveur DNS Windows. Se défait avec Remove-DnsServerZone.',
    effet: 'modification',
    intentions: ['créer une zone dns', 'add-dnsserverprimaryzone', 'zone de recherche directe', 'nouvelle zone dns', 'créer une zone directe'],
    motsCles: ['dns', 'zone', 'directe', 'add-dnsserverprimaryzone', 'windows server', 'nom'],
    params: [ZONE],
    privileges: 'Rôle Serveur DNS installé ; PowerShell en administrateur (ou membre de « Administrateurs DNS »).',
    etapes: [
      mod('Créer la zone', 'Zone principale stockée dans un fichier. Sur un contrôleur de domaine, remplace -ZoneFile par -ReplicationScope Domain pour la stocker dans l’annuaire et la répliquer.', [ps('Add-DnsServerPrimaryZone -Name {{zone}} -ZoneFile "{{zone}}.dns"')], 'Aucun message en cas de succès. Une erreur « existe déjà » : la zone est déjà là.'),
      lec('Vérifier', 'La zone doit apparaître dans la liste, de type Primary.', [ps('Get-DnsServerZone -Name {{zone}}')], 'ZoneName : lab.local, ZoneType : Primary.', { verification: true }),
    ],
    verification: ['La zone existe, de type Primary.'],
    retour: 'Remove-DnsServerZone -Name (nom de la zone) supprime la zone et tous ses enregistrements, après confirmation.',
    assistant: 'dns-zone',
    sources: [src('Add-DnsServerPrimaryZone', '/powershell/module/dnsserver/add-dnsserverprimaryzone'), src('Get-DnsServerZone', '/powershell/module/dnsserver/get-dnsserverzone')],
  }),
  fiche({
    id: 'win-dns-zone-inverse', titre: 'Créer une zone DNS inverse', categorie: 'Windows Server',
    resume: 'Crée une zone qui traduit des adresses IP en noms (recherche inversée) pour un réseau. À lancer sur un contrôleur de domaine pour la stocker dans l’annuaire. Se défait avec Remove-DnsServerZone.',
    effet: 'modification',
    intentions: ['créer une zone inverse', 'zone de recherche inversée', 'reverse dns windows', 'zone in-addr.arpa', 'enregistrement ptr zone'],
    motsCles: ['dns', 'zone', 'inverse', 'ptr', 'in-addr.arpa', 'add-dnsserverprimaryzone', 'networkid'],
    params: [{ id: 'reseau', label: 'réseau de la zone (notation CIDR)', type: 'cidr', exemple: '192.168.1.0/24', aide: 'Le réseau dont on veut traduire les adresses en noms.' }],
    privileges: 'Rôle Serveur DNS sur un contrôleur de domaine ; PowerShell en administrateur.',
    etapes: [
      mod('Créer la zone inverse', 'Le nom de la zone (1.168.192.in-addr.arpa) se déduit du réseau. Sur un serveur DNS autonome (hors domaine), remplace -ReplicationScope Domain par -ZoneFile avec le nom de la zone suivi de .dns.', [ps('Add-DnsServerPrimaryZone -NetworkId "{{reseau}}" -ReplicationScope Domain')], 'Aucun message en cas de succès.'),
      lec('Vérifier', 'La zone inverse doit apparaître dans la liste.', [ps('Get-DnsServerZone | Where-Object IsReverseLookupZone | Select-Object ZoneName, ZoneType')], 'Une ligne 1.168.192.in-addr.arpa (pour 192.168.1.0/24), de type Primary.', { verification: true }),
    ],
    verification: ['La zone in-addr.arpa correspondant au réseau existe.'],
    retour: 'Remove-DnsServerZone -Name (nom de la zone inverse) supprime la zone après confirmation.',
    assistant: 'dns-zone',
    sources: [src('Add-DnsServerPrimaryZone', '/powershell/module/dnsserver/add-dnsserverprimaryzone'), src('Get-DnsServerZone', '/powershell/module/dnsserver/get-dnsserverzone')],
  }),
  fiche({
    id: 'win-dns-enregistrement-a', titre: 'Créer un enregistrement DNS (type A)', categorie: 'Windows Server',
    resume: 'Associe un nom d’hôte à une adresse IPv4 dans une zone DNS (par exemple srv1.lab.local vers 192.168.1.10). Se défait avec Remove-DnsServerResourceRecord.',
    effet: 'modification',
    intentions: ['créer un enregistrement dns', 'add-dnsserverresourcerecorda', 'enregistrement a dns', 'ajouter un nom dans le dns', 'associer un nom à une adresse ip'],
    motsCles: ['dns', 'enregistrement', 'type a', 'add-dnsserverresourcerecorda', 'nom d’hôte', 'zone'],
    params: [ZONE, { id: 'nom', label: 'nom de l’hôte', type: 'identifiant', exemple: 'srv1', aide: 'Le nom court, sans la zone : srv1 donnera srv1.lab.local.' }, IP('ip', 'adresse IPv4', '192.168.1.10')],
    privileges: 'Rôle Serveur DNS ; PowerShell en administrateur (ou membre de « Administrateurs DNS »).',
    etapes: [
      mod('Créer l’enregistrement', 'Ajoute la correspondance nom vers adresse dans la zone.', [ps('Add-DnsServerResourceRecordA -ZoneName {{zone}} -Name {{nom}} -IPv4Address {{ip}}')], 'Aucun message en cas de succès. Une erreur « zone introuvable » : crée d’abord la zone.'),
      lec('Lire l’enregistrement', 'Relit l’enregistrement tel que le serveur le stocke.', [ps('Get-DnsServerResourceRecord -ZoneName {{zone}} -Name {{nom}}')], 'Une ligne RecordType : A avec l’adresse attendue.'),
      lec('Tester la résolution', 'Interroge le serveur local : le nom complet doit donner l’adresse.', [ps('Resolve-DnsName {{nom}}.{{zone}} -Server localhost')], 'Une ligne Type A avec l’adresse attendue.', { verification: true }),
    ],
    verification: ['Resolve-DnsName retourne l’adresse attendue pour le nom complet.'],
    retour: 'Remove-DnsServerResourceRecord -ZoneName (zone) -RRType A -Name (nom) -Force supprime l’enregistrement.',
    assistant: 'dns-record',
    sources: [src('Add-DnsServerResourceRecordA', '/powershell/module/dnsserver/add-dnsserverresourcerecorda'), src('Get-DnsServerResourceRecord', '/powershell/module/dnsserver/get-dnsserverresourcerecord'), src('Resolve-DnsName', '/powershell/module/dnsclient/resolve-dnsname')],
  }),

  // =========================================================================
  // WINDOWS SERVER : PARTAGES
  // =========================================================================
  fiche({
    id: 'win-partage-creer', titre: 'Créer un dossier partagé (SMB)', categorie: 'Windows Server',
    resume: 'Crée un dossier puis le partage sur le réseau, en donnant le droit de modification à un groupe. Les droits NTFS du dossier se règlent à part. Se défait avec Remove-SmbShare.',
    effet: 'modification',
    intentions: ['créer un dossier partagé', 'new-smbshare', 'partager un dossier windows', 'créer un partage réseau', 'partage smb windows server'],
    motsCles: ['partage', 'smb', 'dossier', 'new-smbshare', 'windows server', 'réseau', 'groupe'],
    params: [CHEMIN, PARTAGE, PRINCIPAL],
    privileges: 'Windows Server ou Windows en administrateur local ; PowerShell ouvert en administrateur.',
    etapes: [
      mod('Créer le dossier', 'Le dossier à partager. Une erreur « existe déjà » est sans conséquence si c’est bien le bon dossier.', [ps('New-Item -ItemType Directory -Path "{{chemin}}"')], 'Un résumé du dossier créé (Mode, LastWriteTime, Name).'),
      mod('Partager le dossier', 'Le groupe indiqué reçoit le droit « Modification » au niveau du partage. Les droits NTFS du dossier s’ajoutent : c’est le plus restrictif des deux qui s’applique.', [ps('New-SmbShare -Name {{partage}} -Path "{{chemin}}" -ChangeAccess "{{principal}}"')], 'Un tableau avec le nom du partage, son chemin et sa portée.'),
      lec('Vérifier le partage et ses accès', 'Le partage doit être listé, avec le groupe en accès Change.', [ps('Get-SmbShare -Name {{partage}}'), ps('Get-SmbShareAccess -Name {{partage}}')], 'Le partage avec son chemin ; une ligne d’accès avec le groupe et AccessRight : Change.', { verification: true }),
    ],
    verification: ['Le partage est listé et le groupe a bien le droit Change ; l’accès depuis un poste se teste avec \\\\serveur\\partage.'],
    retour: 'Remove-SmbShare -Name (nom du partage) supprime le partage ; le dossier et son contenu restent en place.',
    assistant: 'shared-folder',
    sources: [src('New-SmbShare', '/powershell/module/smbshare/new-smbshare'), src('Get-SmbShareAccess', '/powershell/module/smbshare/get-smbshareaccess')],
  }),
  fiche({
    id: 'win-partage-ntfs', titre: 'Donner des droits NTFS sur un dossier (icacls)', categorie: 'Windows Server',
    resume: 'Donne à un groupe ou à un compte le droit de modifier un dossier et tout ce qu’il contient. Complète les droits de partage. Se défait avec icacls /remove.',
    effet: 'modification',
    intentions: ['droits ntfs', 'icacls', 'permissions dossier windows', 'donner accès à un dossier', 'modifier les permissions ntfs'],
    motsCles: ['ntfs', 'icacls', 'permissions', 'droits', 'dossier', 'groupe', 'partage'],
    methode: 'cmd',
    params: [CHEMIN, PRINCIPAL],
    privileges: 'Invite de commandes ouverte en administrateur.',
    etapes: [
      lec('Lire les droits actuels', 'Note les droits en place avant de les changer.', [cmdw('icacls "{{chemin}}"')], 'Une liste d’entrées « compte:(droits) », avec le dossier en première ligne.'),
      mod('Accorder le droit de modification', '(OI)(CI) fait hériter le droit aux fichiers et aux sous-dossiers ; M signifie « Modification ».', [cmdw('icacls "{{chemin}}" /grant "{{principal}}:(OI)(CI)M"')], '« Fichiers correctement traités : 1 ; échec du traitement de 0 fichiers ».', { important: 'Évite de donner « Contrôle total » (F) : Modification (M) suffit à la plupart des usages.' }),
      lec('Vérifier', 'L’entrée du groupe doit apparaître avec (OI)(CI)(M).', [cmdw('icacls "{{chemin}}"')], 'Une ligne pour le groupe ou le compte avec (OI)(CI)(M).', { verification: true }),
    ],
    verification: ['Le compte ou le groupe figure dans la liste avec le droit (M).'],
    retour: 'icacls (dossier) /remove (groupe ou compte) retire toutes les entrées de ce compte.',
    assistant: 'file-permissions-audit',
    sources: [src('icacls', '/windows-server/administration/windows-commands/icacls')],
  }),
  fiche({
    id: 'win-partage-voir', titre: 'Voir les partages et les accès ouverts', categorie: 'Windows Server',
    resume: 'Liste les partages du serveur, leurs droits, et qui est connecté en ce moment. Lecture seule.',
    effet: 'lecture',
    intentions: ['voir les partages', 'get-smbshare', 'qui est connecté au partage', 'sessions smb', 'droits d’un partage'],
    motsCles: ['partage', 'smb', 'get-smbshare', 'get-smbsession', 'sessions', 'droits'],
    params: [PARTAGE],
    privileges: 'PowerShell en administrateur sur le serveur de fichiers.',
    etapes: [
      lec('Lister les partages', 'Chaque partage avec son chemin ; les partages se terminant par $ sont des partages administratifs.', [ps('Get-SmbShare | Select-Object Name, Path, Description')], 'Une ligne par partage, dont les partages administratifs C$, IPC$ et ADMIN$.'),
      lec('Voir les droits d’un partage', 'Qui a quel droit au niveau du partage.', [ps('Get-SmbShareAccess -Name {{partage}}')], 'Une ligne par compte avec AccessControlType (Allow) et AccessRight (Read, Change ou Full).'),
      lec('Voir qui est connecté', 'Les sessions SMB ouvertes en ce moment.', [ps('Get-SmbSession | Select-Object ClientComputerName, ClientUserName, NumOpens')], 'Une ligne par session ; aucune ligne si personne n’est connecté.', { verification: true }),
    ],
    verification: ['Le partage et ses droits sont ceux attendus.'],
    assistant: 'smb-sessions-diagnostic',
    sources: [src('Get-SmbShare', '/powershell/module/smbshare/get-smbshare'), src('Get-SmbShareAccess', '/powershell/module/smbshare/get-smbshareaccess'), src('Get-SmbSession', '/powershell/module/smbshare/get-smbsession')],
  }),
  fiche({
    id: 'win-partage-connecter', titre: 'Connecter un lecteur réseau (net use)', categorie: 'Réseau',
    resume: 'Associe une lettre de lecteur à un partage du serveur, depuis un poste Windows. La connexion reste après le redémarrage. Se défait avec net use /delete.',
    effet: 'modification',
    intentions: ['connecter un lecteur réseau', 'net use', 'mapper un lecteur', 'accéder à un partage windows', 'lecteur réseau z'],
    motsCles: ['net use', 'lecteur réseau', 'partage', 'smb', 'mapper', 'serveur'],
    methode: 'cmd',
    params: [{ id: 'lettre', label: 'lettre du lecteur', type: 'choix', choix: ['Z', 'Y', 'X', 'W', 'V'], exemple: 'Z', aide: 'Une lettre libre : Z, Y, X, W ou V.' },
      { id: 'serveur', label: 'nom du serveur', type: 'hote', exemple: 'srv1', aide: 'Le nom du serveur de fichiers.' }, PARTAGE],
    privileges: 'Utilisateur ordinaire ; ses droits sur le partage décident de ce qu’il pourra faire.',
    etapes: [
      mod('Connecter le lecteur', 'La lettre pointe vers le partage du serveur. Si un nom et un mot de passe sont nécessaires, Windows les demande.', [cmdw('net use {{lettre}}: \\\\{{serveur}}\\{{partage}} /persistent:yes')], '« La commande s’est terminée correctement. » Une erreur 53 : le nom du serveur est introuvable ; une erreur 5 : accès refusé.'),
      lec('Vérifier', 'La liste des connexions réseau montre le lecteur et son état.', [cmdw('net use')], 'Une ligne OK avec la lettre et le chemin \\\\serveur\\partage.', { verification: true }),
    ],
    verification: ['Le lecteur apparaît dans l’Explorateur de fichiers et son contenu s’ouvre.'],
    retour: 'net use (lettre): /delete déconnecte le lecteur.',
    assistant: 'network-share-diagnostic',
    sources: [src('net use', '/windows-server/administration/windows-commands/net-use')],
  }),

  // =========================================================================
  // COMPTES LOCAUX
  // =========================================================================
  fiche({
    id: 'win-local-voir-comptes', titre: 'Voir les comptes et groupes locaux', categorie: 'Poste de travail Windows',
    resume: 'Liste les comptes locaux du poste (actifs ou non) et les membres d’un groupe, comme Administrateurs. Lecture seule.',
    effet: 'lecture',
    intentions: ['voir les comptes locaux', 'get-localuser', 'membres du groupe administrateurs', 'liste des utilisateurs windows', 'get-localgroupmember'],
    motsCles: ['compte local', 'get-localuser', 'get-localgroupmember', 'administrateurs', 'groupe', 'windows'],
    params: [{ id: 'groupe', label: 'nom du groupe local', type: 'identifiant', exemple: 'Administrateurs', aide: 'Sur un Windows en français : Administrateurs, Utilisateurs. En anglais : Administrators, Users.' }],
    privileges: 'Utilisateur ordinaire pour la lecture.',
    etapes: [
      lec('Lister les comptes locaux', 'Une ligne par compte, avec son état et sa dernière ouverture de session.', [ps('Get-LocalUser | Select-Object Name, Enabled, LastLogon')], 'Une ligne par compte (Administrateur, Invité, vos comptes).'),
      lec('Lister les groupes locaux', 'Les groupes disponibles sur ce poste.', [ps('Get-LocalGroup | Select-Object Name')], 'Une liste de groupes (Administrateurs, Utilisateurs…).'),
      lec('Lister les membres d’un groupe', 'Qui appartient au groupe : pour Administrateurs, ce sont ceux qui ont tous les droits sur le poste.', [ps('Get-LocalGroupMember -Group {{groupe}}')], 'Une ligne par membre, avec son type (utilisateur ou groupe) et son origine.', { verification: true }),
    ],
    verification: ['Les comptes et les membres sont ceux attendus ; un membre inconnu d’un groupe d’administrateurs mérite une enquête.'],
    assistant: 'local-accounts-audit',
    sources: [src('Get-LocalUser', '/powershell/module/microsoft.powershell.localaccounts/get-localuser'), src('Get-LocalGroupMember', '/powershell/module/microsoft.powershell.localaccounts/get-localgroupmember')],
  }),
  fiche({
    id: 'win-local-creer-utilisateur', titre: 'Créer un compte local Windows', categorie: 'Poste de travail Windows',
    resume: 'Crée un compte local avec un mot de passe demandé par PowerShell (jamais écrit dans la commande) et l’ajoute à un groupe local. Se défait avec Remove-LocalUser.',
    effet: 'modification',
    intentions: ['créer un compte local windows', 'new-localuser', 'ajouter un utilisateur local', 'créer un utilisateur sur le poste', 'ajouter au groupe administrateurs'],
    motsCles: ['compte local', 'new-localuser', 'add-localgroupmember', 'utilisateur', 'windows', 'groupe'],
    params: [{ ...COMPTE, label: 'nom du compte local', exemple: 'marie' },
      { id: 'nom', label: 'nom complet affiché', type: 'nom', exemple: 'Marie Tremblay', aide: 'Le nom affiché sur l’écran de connexion.' },
      { id: 'groupe', label: 'groupe local', type: 'identifiant', exemple: 'Utilisateurs', aide: 'Sur un Windows en français : Utilisateurs ou Administrateurs. En anglais : Users ou Administrators.' }],
    privileges: 'PowerShell ouvert en tant qu’administrateur du poste.',
    etapes: [
      mod('Créer le compte', 'PowerShell demande le mot de passe (saisie masquée) : il n’entre ni à l’écran ni dans l’historique.', [ps('New-LocalUser -Name {{compte}} -FullName "{{nom}}" -Password (Read-Host -AsSecureString "Mot de passe")')], 'Une invite « Mot de passe : », puis un résumé du compte créé (Name, Enabled, Description).'),
      mod('L’ajouter à un groupe', 'Sans groupe, le compte n’a pas les droits d’ouvrir une session normale : Utilisateurs suffit pour un usage courant.', [ps('Add-LocalGroupMember -Group {{groupe}} -Member {{compte}}')], 'Aucun message en cas de succès.', { important: 'Ne mets dans Administrateurs que les comptes qui en ont vraiment besoin : ce groupe donne tous les droits sur le poste.' }),
      lec('Vérifier', 'Le compte doit être activé et figurer dans le groupe.', [ps('Get-LocalUser -Name {{compte}} | Select-Object Name, Enabled'), ps('Get-LocalGroupMember -Group {{groupe}}')], 'Enabled : True, et le compte dans la liste des membres du groupe.', { verification: true }),
    ],
    verification: ['Le compte est activé, membre du bon groupe, et peut ouvrir une session.'],
    retour: 'Remove-LocalUser -Name (nom du compte) supprime le compte ; son profil (dossier utilisateur) reste sur le disque.',
    assistant: 'local-accounts-audit',
    sources: [src('New-LocalUser', '/powershell/module/microsoft.powershell.localaccounts/new-localuser'), src('Add-LocalGroupMember', '/powershell/module/microsoft.powershell.localaccounts/add-localgroupmember')],
  }),
];
