/**
 * procedures-windows-ad-simples.mjs — KJEMO-WINDOWS-SIMPLES-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Consultations courantes d'Active Directory (lecture seule) : membres d'un
 * groupe, informations d'un compte, un ordinateur, le contrôleur de domaine
 * joint, l'âge du mot de passe. Même contrat que les autres fiches Windows.
 * Non exécuté sur un contrôleur de domaine réel.
 */
import { fiche, ps, lec, src, RSAT, COMPTE } from './procedures-windows-simples.mjs';

const AD = '/powershell/module/activedirectory';
const CAT = 'Active Directory';

export const PROCEDURES_WINDOWS_AD = [
  fiche({
    id: 'win-ad-membres-groupe', titre: 'Voir les membres d’un groupe Active Directory', categorie: CAT, effet: 'lecture',
    resume: 'Liste les comptes et groupes membres d’un groupe, directement ou en comptant les sous-groupes. Répond à « qui a accès à ce partage ? ».',
    intentions: ['get-adgroupmember', 'qui fait partie du groupe', 'liste des membres d’un groupe ad', 'membres d’un groupe de sécurité', 'groupe imbriqué active directory'],
    motsCles: ['active directory', 'groupe', 'membres', 'get-adgroupmember', 'récursif', 'imbriqué'], privileges: RSAT,
    params: [{ id: 'groupe', label: 'nom du groupe', type: 'identifiant', exemple: 'Ventes_G', aide: 'Le nom court du groupe, sans espace.' }],
    etapes: [
      lec('Membres directs', 'Les comptes et groupes placés directement dans ce groupe.', [ps('Get-ADGroupMember -Identity {{groupe}} | Select-Object Name, SamAccountName, objectClass')], 'Une ligne par membre, avec sa classe (user, group, computer).'),
      lec('Membres avec les sous-groupes', '-Recursive développe les groupes imbriqués : on obtient les comptes réellement concernés.', [ps('Get-ADGroupMember -Identity {{groupe}} -Recursive | Select-Object Name, SamAccountName')], 'Un compte par ligne, sans les groupes intermédiaires.'),
      lec('Compter', 'Savoir combien de comptes sont réellement concernés.', [ps('(Get-ADGroupMember -Identity {{groupe}} -Recursive | Measure-Object).Count')], 'Un nombre. Une erreur « introuvable » : vérifie le nom du groupe.', { verification: true }),
    ],
    verification: ['Les membres attendus figurent dans la liste.'],
    sources: [src('Get-ADGroupMember', `${AD}/get-adgroupmember`)],
  }),
  fiche({
    id: 'win-ad-infos-utilisateur', titre: 'Voir les informations d’un compte (état, groupes, dernière connexion)', categorie: CAT, effet: 'lecture',
    resume: 'Rassemble l’état d’un compte : activé, verrouillé, dernière connexion, âge du mot de passe et groupes. La première lecture quand un utilisateur ne peut pas se connecter.',
    intentions: ['informations d’un utilisateur active directory', 'get-aduser properties', 'dernière connexion d’un compte', 'pourquoi l’utilisateur ne peut pas se connecter', 'groupes d’un utilisateur ad'],
    motsCles: ['active directory', 'utilisateur', 'get-aduser', 'verrouillé', 'lastlogondate', 'memberof'], privileges: RSAT,
    params: [{ ...COMPTE, label: 'nom de connexion (SamAccountName)', exemple: 'jdupont' }],
    etapes: [
      lec('État du compte', 'Enabled, LockedOut et les dates utiles en une seule ligne.', [ps('Get-ADUser -Identity {{compte}} -Properties Enabled, LockedOut, LastLogonDate, PasswordLastSet, PasswordExpired, whenCreated | Select-Object Name, SamAccountName, Enabled, LockedOut, PasswordExpired, PasswordLastSet, LastLogonDate, whenCreated')], 'Enabled : True, LockedOut : False pour un compte sain. Un mot de passe expiré ou un compte verrouillé explique un refus de connexion.'),
      lec('Groupes du compte', 'Les groupes dont il est membre directement.', [ps('Get-ADPrincipalGroupMembership -Identity {{compte}} | Select-Object Name | Sort-Object Name')], 'Une ligne par groupe (Utilisateurs du domaine y figure toujours).', { verification: true }),
    ],
    verification: ['L’état (activé, verrouillé, mot de passe) et les groupes correspondent à ce qu’on attend du compte.'],
    sources: [src('Get-ADUser', `${AD}/get-aduser`), src('Get-ADPrincipalGroupMembership', `${AD}/get-adprincipalgroupmembership`)],
  }),
  fiche({
    id: 'win-ad-trouver-ordinateur', titre: 'Retrouver un ordinateur dans le domaine', categorie: CAT, effet: 'lecture',
    resume: 'Retrouve le compte d’un ordinateur : système d’exploitation, dernière connexion au domaine, adresse IP connue et OU où il se trouve. Pratique pour dépanner ou faire le ménage.',
    intentions: ['get-adcomputer', 'retrouver un ordinateur du domaine', 'dernière connexion d’un poste au domaine', 'dans quelle ou est cet ordinateur', 'chercher un poste active directory'],
    motsCles: ['active directory', 'ordinateur', 'get-adcomputer', 'poste', 'domaine', 'inventaire'], privileges: RSAT,
    params: [{ id: 'ordinateur', label: 'nom (ou début du nom) de l’ordinateur', type: 'hote', exemple: 'PC-VENTES01', aide: 'Le nom du poste ou son début.' }],
    etapes: [
      lec('Chercher par nom', 'Le signe * est ajouté à la fin : les noms qui commencent par ta valeur sont trouvés.', [ps('Get-ADComputer -Filter \'Name -like "{{ordinateur}}*"\' -Properties OperatingSystem, LastLogonDate, IPv4Address | Select-Object Name, OperatingSystem, LastLogonDate, IPv4Address, DistinguishedName')], 'Une ligne par ordinateur, avec le système d’exploitation et la dernière connexion.'),
      lec('Compter les résultats', 'Savoir si la recherche est assez précise.', [ps('(Get-ADComputer -Filter \'Name -like "{{ordinateur}}*"\' | Measure-Object).Count')], 'Un nombre. 0 : aucun ordinateur de ce nom dans le domaine.', { verification: true }),
    ],
    verification: ['L’ordinateur cherché est trouvé, avec la bonne OU et une dernière connexion récente.'],
    sources: [src('Get-ADComputer', `${AD}/get-adcomputer`)],
  }),
  fiche({
    id: 'win-ad-controleur-connecte', titre: 'Voir quel contrôleur de domaine répond au poste', categorie: CAT, effet: 'lecture',
    resume: 'Montre le contrôleur de domaine qui sert le poste et vérifie qu’il est joignable. Premier test quand « le domaine est introuvable » ou que l’ouverture de session est lente.',
    intentions: ['nltest /dsgetdc', 'quel contrôleur de domaine utilise mon poste', 'get-addomaincontroller discover', 'domaine introuvable', 'logonserver'],
    motsCles: ['contrôleur de domaine', 'nltest', 'dsgetdc', 'logonserver', 'domaine', 'dns'],
    params: [{ id: 'domaine', label: 'nom du domaine', type: 'fqdn', exemple: 'lab.local', aide: 'Le nom DNS du domaine, par exemple lab.local.' }],
    etapes: [
      lec('Chercher un contrôleur de domaine', 'Le poste interroge le DNS pour trouver un contrôleur de domaine.', [ps('nltest /dsgetdc:{{domaine}}')], 'Le nom du contrôleur (DC:), son adresse, le site et le nom du domaine. Une erreur « domaine introuvable » vient presque toujours d’un DNS mal configuré.'),
      lec('Serveur qui a ouvert la session', 'Le contrôleur qui a authentifié ta session actuelle.', [ps('Write-Host $env:LOGONSERVER')], 'Le nom du contrôleur, précédé de deux barres obliques inverses.'),
      lec('Tester la joignabilité', 'Vérifie que le contrôleur répond sur le service d’annuaire (LDAP, port 389).', [ps('Test-NetConnection -ComputerName {{domaine}} -Port 389')], 'TcpTestSucceeded : True.', { verification: true }),
    ],
    verification: ['Un contrôleur de domaine est trouvé et répond sur le port 389.'],
    sources: [src('nltest', '/windows-server/administration/windows-commands/nltest'), src('Test-NetConnection', '/powershell/module/nettcpip/test-netconnection')],
  }),
  fiche({
    id: 'win-ad-mot-de-passe-age', titre: 'Voir l’âge et l’expiration du mot de passe d’un compte', categorie: CAT, effet: 'lecture',
    resume: 'Donne la date du dernier changement de mot de passe, la date d’expiration calculée et si le mot de passe est configuré pour ne jamais expirer. Lecture seule.',
    intentions: ['quand expire le mot de passe', 'date du dernier changement de mot de passe ad', 'msds-userpasswordexpirytimecomputed', 'mot de passe n’expire jamais', 'vérifier l’expiration du mot de passe d’un compte'],
    motsCles: ['mot de passe', 'expiration', 'passwordlastset', 'active directory', 'compte', 'politique'], privileges: RSAT,
    params: [{ ...COMPTE, label: 'nom de connexion (SamAccountName)', exemple: 'jdupont' }],
    etapes: [
      lec('Lire les dates', 'PasswordLastSet : dernier changement. PasswordNeverExpires : True si le compte est exempté de la politique.', [ps('Get-ADUser -Identity {{compte}} -Properties PasswordLastSet, PasswordNeverExpires, PasswordExpired | Select-Object Name, PasswordLastSet, PasswordNeverExpires, PasswordExpired')], 'Les dates et deux valeurs True / False.'),
      lec('Calculer la date d’expiration', 'La date vient d’un attribut calculé par le domaine, converti en date lisible.', [ps('[datetime]::FromFileTime((Get-ADUser -Identity {{compte}} -Properties "msDS-UserPasswordExpiryTimeComputed")."msDS-UserPasswordExpiryTimeComputed")')], 'Une date et une heure d’expiration. Une date en 1601 ou très lointaine : le mot de passe n’expire jamais.', { verification: true }),
    ],
    verification: ['La date d’expiration affichée correspond à la politique de mot de passe du domaine.'],
    sources: [src('Get-ADUser', `${AD}/get-aduser`)],
  }),
];
