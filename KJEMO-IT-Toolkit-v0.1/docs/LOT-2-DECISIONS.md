# LOT 2 — Décisions techniques

Ce document explique les choix qui ne se lisent pas dans le code, et surtout
ceux qui consistent à **ne pas** automatiser quelque chose. Il est destiné à la
revue indépendante et aux lots suivants.

---

## 1. Architecture des modules

### Pourquoi `noyau.mjs`

`psB64()` et `assertValid()` vivaient dans `generators.mjs`. Le catalogue
Windows Server a besoin des deux, et `generators.mjs` importe ce catalogue pour
le concaténer au sien. Les deux fichiers se seraient importés mutuellement.

Un cycle ESM fonctionne souvent — les déclarations de fonctions sont hissées —
mais échoue dès qu'une valeur est lue au moment de l'évaluation du module, et le
diagnostic est pénible. Les deux fonctions sont donc extraites dans un module
sans dépendance. `generators.mjs` les ré-exporte : **aucun importateur existant
ne change**, et un test vérifie l'identité des références (`===`), pas seulement
le comportement, pour garantir qu'il n'existe pas deux copies.

### Découpage retenu

| Module | Dépendances | Contenu |
|---|---|---|
| `dist/noyau.mjs` | aucune | `psB64`, `assertValid` |
| `dist/validateurs.mjs` | aucune | tous les validateurs stricts |
| `dist/rapport-ps.mjs` | aucune | fragments PowerShell communs |
| `dist/outils-serveur.mjs` | les trois ci-dessus | les 14 outils du LOT 2 |
| `dist/generators.mjs` | les quatre ci-dessus | catalogue unique, ré-exports |

`generators.mjs` reste le **point d'entrée canonique** : l'interface et les
tests n'importent que lui. La règle du LOT 0 — une seule copie du catalogue —
est respectée.

### `validateIPv4` et `validateShareName` déplacés

Ils partent dans `validateurs.mjs`, à l'identique, messages compris. Les huit
outils historiques les utilisent via le ré-export. La garde d'identité des 64
scripts confirme que rien n'a bougé.

---

## 2. Ce qui n'est PAS automatisé, et pourquoi

Chaque point ci-dessous est un refus délibéré. Automatiser aurait été plus
rapide à écrire et plus dangereux à exécuter.

| Opération | Décision | Raison |
|---|---|---|
| `Restore-DhcpServer` | documentée, non automatisée | Remplace la configuration en place, étendues et baux compris. Se décide, ne se clique pas. |
| Désinstallation du rôle DHCP | cas exceptionnel documenté | Supprime la base des baux. Les clients tombent sans adresse à l'expiration. |
| Suppression d'une étendue ayant servi | cas exceptionnel documenté | Efface baux et réservations. Coupe le service sur tout un réseau. |
| Suppression d'une zone DNS en service | cas exceptionnel documenté | Sur un domaine AD, rend le domaine inutilisable : ouverture de session, réplication, services. |
| `Close-SmbOpenFile` / `Close-SmbSession` | cas exceptionnel documenté | Fait perdre le travail non enregistré de la personne qui utilise le fichier. |
| Activation d'ICS | **impossible proprement** | Aucune API officielle scriptable. Les méthodes qui circulent passent par le registre non documenté ou par du COM obscur. Ce lot refuse les deux et renvoie à `ncpa.cpl`. |
| Configuration du NAT RRAS | non automatisée, limite assumée | Les cmdlets modernes ne couvrent pas entièrement ce scénario. Employer `netsh routing` obsolète serait pire qu'utile : le lot s'arrête à la préparation et renvoie à la procédure officielle. |
| Désinstallation du rôle RemoteAccess | cas exceptionnel documenté | Coupe l'accès Internet de tout le réseau interne, redémarrage généralement exigé. |

Le principe commun : **ce qui est réversible est automatisé ; ce qui est
irréversible est expliqué.**

---

## 3. Mode Diagnostic par défaut

Tout outil pouvant modifier la configuration porte un sélecteur de mode dont la
valeur par défaut est `Diagnostic`. En mode Diagnostic :

- les contrôles sont exécutés et le rapport est produit ;
- les commandes modifiantes sont montrées en `-WhatIf` lorsque le cmdlet le
  prend en charge ;
- un bloc final annonce explicitement qu'aucune modification n'a eu lieu.

Un test vérifie cette propriété pour chaque outil modifiant, et un autre
vérifie qu'un outil de diagnostic ne contient aucun cmdlet modifiant hors d'une
liste explicite de cmdlets de collecte (`Add-KjemoResultat`, `New-Object`,
`Set-Content`, `New-Item`, `Start-Sleep`, `Add-Member`, `New-TimeSpan`).

---

## 4. Idempotence

Chaque opération de création vérifie d'abord l'existant :

- étendue DHCP : ni recréée, ni écrasée ;
- exclusion : ajoutée seulement si la paire début/fin n'existe pas ;
- réservation : ignorée si identique, refusée si conflit ;
- zone DNS : **jamais remplacée** — remplacer une zone efface ses
  enregistrements ;
- enregistrement DNS : doublon exact ignoré, conflit de valeur refusé,
  collision CNAME détectée.

Relancer un script ne casse rien et ne duplique rien.

---

## 5. Validation stricte

Aucune validation permissive. Les cas explicitement refusés :

- `parseInt('12abc')` → refusé (`24abc`, `1.5`, `007`) ;
- masque non contigu (`255.0.255.0`) ;
- réseau CIDR écrit avec une adresse d'hôte (`192.168.30.7/24`) — le message
  propose le réseau correct ;
- plage inversée, hors réseau, incluant l'adresse de réseau ou de diffusion ;
- passerelle ou serveur DNS compris dans la plage distribuée ;
- exclusion débordant de la plage ;
- MAC tronquée saisie avec séparateurs — voir ci-dessous ;
- chemin UNC pour la sauvegarde DHCP ;
- PTR dans une zone directe, A dans une zone inversée ;
- MX, SRV, TXT : hors périmètre, refusés avec un message qui le dit ;
- mises à jour sécurisées sur une zone stockée en fichier ;
- carte interne et carte externe identiques (ICS et RRAS).

### Cas particulier : MAC ou ClientId

Le champ accepte les deux. Une saisie **avec séparateurs** est traitée comme une
tentative d'adresse MAC et doit faire six octets : `00-15-5D-01-2A` est refusé.
Sans séparateur, une longueur différente est acceptée comme ClientId DHCP,
usage légitime. Sans cette distinction, une MAC tronquée passait pour un
ClientId de cinq octets — c'est une contre-épreuve du lot qui l'a révélé.

---

## 6. Rapports

Structure commune : catégorie, contrôle, état (`OK`, `ATTENTION`, `PROBLEME`,
`INFO`, `IGNORE`), valeur, commentaire. Un même jeu de données alimente la
console, le JSON, le HTML et le CSV sans retraitement.

Le rapport contient date, machine, version du système, paramètres **non
sensibles**, contrôles, résultats, avertissements, conclusion et version de
l'outil. Il ne contient jamais de mot de passe, de jeton, d'identifiant ni de
contenu de fichier utilisateur — aucun champ de formulaire n'en demande, et un
test balaie les fragments de rapport à la recherche de ces motifs.

Les fichiers sont écrits sur le Bureau de la session, jamais sur un partage
réseau.

---

## 7. Compatibilité déclarée

| Cible | Statut |
|---|---|
| Windows Server 2019, 2022 | modules intégrés, cmdlets documentées |
| Windows Server 2025 | cmdlets documentées identiques, **non éprouvées en laboratoire par ce projet** |
| Windows PowerShell 5.1 | cible de référence — `#Requires -Version 5.1` en tête de chaque script |
| PowerShell 7 | utilisable ; certains modules de rôle demandent `-UseWindowsPowerShell` |

Aucune compatibilité non testée ni non documentée n'est affirmée. La mention
« non éprouvé en laboratoire » figure telle quelle dans la fiche.

Le code produit évite ce qui n'existe pas en 5.1 : pas d'opérateur ternaire, pas
de `??`, pas de `ForEach-Object -Parallel`, pas de `Join-String`.

---

## 8. Sources

Uniquement des pages Microsoft Learn précises — jamais une page d'accueil,
jamais un blog, jamais une réponse communautaire. Un test vérifie la forme des
URL ; `scripts/verifier-sources.mjs` les interroge réellement.

Ce contrôle a trouvé une URL morte héritée d'un lot précédent
(`install-active-directory-domain-services--level-100`, 404) : elle a été
remplacée par la page du cmdlet `Install-ADDSDomainController`. À noter :
Microsoft Learn répond **200** sur sa page « contenu introuvable » ; le code
HTTP seul ne suffit pas, le titre est le seul indice fiable.

---

## 9. Garde d'identité des 64 scripts historiques

`test/scripts-baseline.json` fige les empreintes SHA-256 des 64 scripts produits
au SHA de base `22b4ead`. `test/generate-ps1.mjs` échoue si l'une d'elles change.

Les scripts des nouveaux outils sont comptés à part : ce qui est interdit, c'est
qu'un script **historique** disparaisse, change ou se dédouble. Les 176 scripts
(22 outils × 8 jeux de données) sont tous analysés par le parseur PowerShell 5.1
et 7 dans la CI.

---

## 10. Limites connues

1. **PowerShell 5.1 n'est pas exécuté localement** : ce conteneur est sous
   Linux. La couverture 5.1 vient du job `windows-latest` de la CI.
2. **Aucun laboratoire Windows Server réel** n'a exécuté ces scripts. Ils sont
   validés en syntaxe (5.1 et 7) et en génération ; leur effet sur un serveur
   réel reste à éprouver. Le projet ne déclare donc pas « testé en
   laboratoire ».
3. **ICS n'est pas activable par script** — limite de Windows, pas du projet.
4. **Le NAT RRAS n'est pas configuré** — limite assumée, expliquée dans le
   rapport de l'outil lui-même.
5. **La restauration DHCP et la suppression de zone** restent manuelles par
   choix.

---

## 11. Décisions reportées

- Traduction technique complète (anglais) : LOT 4, comme prévu.
- MX, SRV, TXT : hors périmètre de ce lot.
- Active Directory avancé, GPO avancé, imprimantes, Linux : lots suivants.
- Un éventuel « KJEMO Runner » exécutant les scripts localement : hors sujet
  ici. Le site reste statique, sans exécution depuis le navigateur.
