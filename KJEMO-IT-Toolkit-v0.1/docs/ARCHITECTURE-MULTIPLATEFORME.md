# Architecture multiplateforme

L'application reste un site statique : elle **génère** des scripts dans le
navigateur et n'en exécute jamais aucun. Le LOT 7 ajoute une seconde chaîne de
sortie, Bash, à côté de PowerShell, sans toucher à la première.

## Deux chaînes, un contrat

| | Windows | Linux |
|---|---|---|
| Sortie | `.ps1`, BOM UTF-8 | `.sh`, sans BOM, fins de ligne LF |
| Normalisation | `normalizeScript` (`generators.mjs`) | `normalizeScriptSh` (`noyau-bash.mjs`) |
| Transport des valeurs | `psB64`, apostrophes doublées | `shQuote` : guillemets simples, `'\''` |
| Gardes | `noyau.mjs` | `gardes-bash.mjs` |
| Validation de saisie | `validateurs.mjs` | `validateurs-linux.mjs` |
| Sources acceptées | Microsoft Learn | `sources-linux.mjs` (liste de domaines primaires) |
| Choix de la chaîne | — | `estBash(outil)` (`plateforme.mjs`) |

Le choix se fait **par outil**, jamais par extension de fichier devinée :
l'aperçu, le bouton Copier et le bouton Télécharger appellent la même
fonction. Un défaut trouvé au LOT 7 (25/n) illustre pourquoi : l'aperçu passait
tous les scripts par la normalisation PowerShell, ce qui corrompait 42
aperçus Bash. Le correctif est dans `dist/app.js` et le banc d'identité
navigateur compare désormais l'aperçu, le presse-papiers et le fichier téléchargé
octet par octet.

## Les modules

- `plateforme.mjs` : plateforme, extension, nom de fichier, mode lecture seule.
- `noyau-bash.mjs` : `shQuote`, normalisation, gabarit d'en-tête et de rapport.
- `gardes-bash.mjs` : bloc de confirmation exacte, porte finale, gardien de chemin.
- `validateurs-linux.mjs` : ports, modes, comptes, groupes, clients NFS, hôtes Samba.
- `outils-linux*.mjs` : les 43 fiches ; `outils-poste-jonction.mjs` : les 3 fiches de jonction.
- `commandes-*.mjs` + `commandes-rapides.mjs` : les 112 commandes rapides et leur contrat.
- `categories.mjs` : catégories et sous-rubriques ; `libelles.mjs` : libellés.

## Navigation actuelle

Huit catégories : Poste de travail Windows, Analyse et nettoyage des disques,
Windows Server, Active Directory, GPO, Réseau, Imprimantes, et **Linux et
services réseau** (onze sous-rubriques ordonnées comme on dépanne :
Diagnostic Linux, Bash et automatisation, Utilisateurs et permissions,
Services et journaux, Réseau Linux, SSH et accès distant, Cockpit, Samba,
Samba AD, NFS, Stockage Linux). Chaque outil a une route `#/outil/<id>` ;
les identifiants et les routes existants sont préservés.

## Hiérarchie cible (documentée, NON implémentée)

La navigation cible tient en quatre niveaux. Elle est consignée ici pour ne
pas être reconstruite de mémoire ; **aucune ligne de code ne la réalise**.

1. **Microsoft Windows** : Poste de travail Windows, Windows Server, Active
   Directory (avec GPO de domaine dessous), Imprimantes Windows.
2. **Linux et services réseau** : Diagnostic Linux, Bash et automatisation,
   Utilisateurs et permissions, Services et journaux, Réseau Linux, SSH,
   Cockpit, Samba, Samba AD, NFS, Stockage Linux.
3. **Réseau et Cisco.**
4. **Cloud** (Azure, AWS) et **Outils multiplateformes**.

Règles : les GPO de domaine passent sous Active Directory ; les politiques
locales restent dans Poste de travail Windows ; DHCP, DNS et serveur de
fichiers relèvent de Windows Server ; **aucun identifiant ni aucune route
existante ne change**.

## Modèle de fiche cible (documenté, NON implémenté)

Onglets CMD / PowerShell / GUI ; commande rapide ; assistant guidé ;
procédure manuelle ; valeurs à remplacer ; aperçu coloré ; bloc copiable brut ;
**copie impossible tant qu'un placeholder subsiste** ; exemple réel ; droits
requis ; risque ; résultat attendu ; vérification ; retour en arrière.
Aujourd'hui, les fiches Linux portent déjà une partie de ces rubriques (droits,
risque, vérification, retour en arrière) ; l'organisation en onglets et le
blocage de la copie sur placeholder n'existent pas.
