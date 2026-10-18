# Sécurité des scripts Bash

Un assistant qui modifie une machine se juge sur ce qu'il refuse. Les verrous
sont **dans le script généré**, pas seulement dans le formulaire : un
formulaire se contourne en éditant le fichier téléchargé.

## Les verrous

1. **Transport des valeurs.** Toute valeur saisie passe par `shQuote` (guillemets
   simples). Un `$(…)`, un backtick ou un point-virgule dans un champ reste du
   texte. Le banc N09 injecte un canari sur tous les champs de tous les
   assistants et exige qu'il ne s'exécute jamais.
2. **Confirmation exacte.** Les 15 assistants modifiants annoncent une phrase
   et la comparent caractère pour caractère : casse, espaces, préfixe, suffixe
   ou phrase d'un autre assistant ne l'ouvrent pas (N01, N02).
3. **Ordre état, action, relecture.** On lit l'état avant d'agir, on relit
   après, et une relecture négative est un échec, pas un avertissement (N04, N05).
4. **Gardien de chemin.** Les écritures sont refusées sous les racines système,
   y compris par lien symbolique vers `/etc` (N08).
5. **Verbe hors liste close refusé** pour les unités de service, les
   protections SSH et réseau (N06, N07).
6. **Modes et comptes.** 777, 666, setuid, récursion sur `/`, groupes
   privilégiés (sudo, docker, disk…) et comptes sensibles sont refusés (N10, N11).
7. **Stockage.** Cible et périphérique libre sont relus ; un nœud bloc fabriqué
   est refusé (N12).
8. **Réseau.** Clients NFS « * », `no_root_squash`, `/0`, hôtes Samba trop
   larges, ports hors bornes sont refusés (N13, N14).
9. **SSH.** Aucun durcissement sans compte nommé et sans preuve d'un second
   accès (N15). **Netplan n'est jamais appliqué** (N16). Netplan refuse en
   outre une passerelle égale à l'hôte, au réseau ou à la diffusion (facultative
   sinon), ne modifie jamais un fichier produit par cloud-init, prépare un
   candidat sous un autre nom, refuse un nom déjà présent dans `/etc/netplan` et
   s'arrête quand plusieurs fichiers déclarent déjà l'interface
   (`test/netplan-v2.test.mjs`).
10. **Diagnostics sans écriture.** 28 assistants : zéro appel modifiant, aucun
    contournement du PATH (N17).
11. **Aucun secret** dans les champs, scripts, URL, rapports (N18).
12. **Jonction de domaine.** Aucun mot de passe en clair, aucun redémarrage
    automatique ; verrous PowerShell éprouvés **statiquement** (N19, niveau 1).

## Comment on le prouve

Chaque famille tient trois temps : un **refus** (le verrou refuse et aucun appel
modifiant n'a lieu, mesuré par des mouchards sur le PATH), un **contrôle
positif** (quand tout est satisfait, la porte s'ouvre : sans lui, on ne
distingue pas un verrou d'un script qui ne fait rien) et une **contre-épreuve**
(on désarme le verrou et le banc doit détecter l'appel interdit). En fin de
course, un contrat vérifie que chaque famille porte les trois temps. Une
seconde couche (`negatifs-lot7-contre-epreuves.test.mjs`) mutile une copie du
produit à 12 endroits et exige que le bon banc devienne rouge.

Le banc compare aussi l'empreinte SHA-256 de fichiers système réels avant et
après : il ne modifie pas la machine qui l'exécute.

## Ce que cela ne prouve pas

Niveau 4 sur 5 : Bash réel, doublures à la place des commandes système.
**Ubuntu Server réel, contrôleur Samba AD réel, export NFS réel, jonction de
domaine réelle : NON EXÉCUTÉ.** Les cas qui exigent `chown` ou `mknod`
réels annoncent NON EXÉCUTÉ (code 77) quand la capacité manque ; en CI, la
capacité est exigée (`KJEMO_CAPACITES_REQUISES=1`) et son absence est un échec.
