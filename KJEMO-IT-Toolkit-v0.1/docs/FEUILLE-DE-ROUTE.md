# Feuille de route — KJEMO IT Toolkit

Ce document consigne ce qui est **fait**, et ce qui est **prévu sans être
commencé**. Il n'anticipe rien : un lot futur y tient trois lignes, pas une
spécification.

## Vocabulaire — six états distincts

Un même travail peut être à six endroits différents, et les confondre est la
première cause de mauvaise surprise. Dans tous les documents de ce projet :

| État | Ce que cela veut dire |
|---|---|
| **Développé localement** | Le code existe sur une branche de travail. Rien n'a été prouvé. |
| **Testé localement** | Les bancs du dépôt passent sur la machine de développement, sous l'interpréteur de cette machine. |
| **Testé en CI** | GitHub Actions a joué la validation complète sur `windows-latest`, sous `powershell` ET sous `pwsh`, séparément. |
| **Fusionné** | Le travail est dans `main`. |
| **Déployé** | La version publiée sur GitHub Pages contient ce travail. |
| **Testé sur une vraie machine** | Un script a été exécuté sur un poste Windows réel, avec du matériel réel, par une personne. |

Un lot « testé localement » n'est **pas** « testé en CI ». Un lot « fusionné »
n'est **pas** « testé sur une vraie machine ». Ces états ne se déduisent pas
l'un de l'autre et aucun document du projet ne doit les mélanger.

## Lots livrés

| Lot | Contenu | Dernier état connu |
|---|---|---|
| LOT 1 | Analyse de disque, première version | fusionné, déployé |
| LOT 2 | Socle de l'application, assembleur, validateurs | fusionné, déployé |
| LOT 3 | Active Directory avancé (15 assistants) | fusionné, déployé |
| LOT 4 | Stratégies de groupe (GPO) | fusionné, déployé |
| LOT 5 | Réseau avancé | fusionné, déployé |
| LOT 6A | Poste de travail Windows, assistants 1 à 12 | développé localement, testé localement — **non fusionné, non déployé** |
| LOT 6B | Poste de travail Windows, assistants 13 à 30 | développé localement, testé localement — **non fusionné, non déployé** |
| LOT 6B V2 | Correctif de la revue Codex sur quatre points | développé localement, testé localement — **non fusionné, non déployé** |
| LOT 6 V3 | Correctif de sécurité du gardien de chemin et du comptage final | développé localement, testé localement — **non fusionné, non déployé** |

L'état exact des LOTS 6A et 6B au moment de leur livraison est consigné dans
leurs rapports respectifs, section « État du push, de la fusion et du
déploiement ». Aucun des deux n'a été exécuté sur un poste Windows réel.

## Lots prévus, non commencés

Les lots ci-dessous sont **consignés, pas développés**. Aucun code, aucune
fiche, aucun test ne leur correspond dans le dépôt. Ils ne sont pas des
sous-rubriques d'un lot existant : en particulier, **Bash, Samba et Azure ne
sont pas des catégories du LOT 6B**, et ne doivent pas y être ajoutés.

### LOT 7 — Linux
Linux, Bash, services, journaux, paquets, SSH, stockage, Samba et NFS.

### LOT 8 — Azure et Entra ID
Azure, Entra ID, machines virtuelles, réseau Azure, stockage, sauvegarde et
diagnostics cloud.

### LOT 9 — Imprimantes
Imprimantes.

### LOT 10 — Disques, analyse avancée
Analyse et nettoyage avancés des disques. Prolonge `disk-scan`, qui reste
l'assistant de référence pour le parcours récursif et les gros dossiers ; les
assistants de stockage du LOT 6B y renvoient explicitement plutôt que de le
dupliquer.

### LOT 11 — Rapports, bilingue, qualité
Rapports, bilingue, sécurité transversale et qualité.

### LOT 12 — Exécution locale facultative
Exécution locale facultative et sécurisée, **seulement après une étude
d'architecture**. L'application est aujourd'hui un site statique qui
**génère** des scripts et ne les exécute jamais ; changer cela est une
décision d'architecture, pas une fonctionnalité à ajouter.

## Ce que ce document ne dit pas

- Il ne dit pas qu'un lot prévu est planifié dans le temps : aucune date n'y
  figure, et aucune ne doit y être ajoutée sans décision.
- Il ne dit pas qu'un lot livré est déployé : la colonne « dernier état
  connu » est à relire à chaque livraison, et un lot non fusionné y reste
  marqué non fusionné.
- Il ne remplace pas les rapports de lot, qui seuls portent les mesures.


## Actualisation du 20 octobre 2026 — audit documentaire Samba (LOT 7)

Cette section actualise le statut du LOT 7 sans modifier les états historiques consignés ci-dessus.

### Références vérifiées
- `main` : `aff0f7a146076f2ee1cf1e621efdde775ea3e9e2`.
- `claude/lot-7-linux-bash-samba-nfs` : `ef8400ff8b77b7108f7b0201bad72db865160343`.
- Comparaison GitHub : branche LOT 7 en avance de 20 commits, sans retard, 53 fichiers ajoutés ou modifiés.
- La branche contient des modules Linux, des commandes rapides et des tests de permissions, RAID, services, réseau, SSH et Cockpit. Aucun fichier ou test explicitement nommé Samba n'a été repéré dans l'arborescence ; une recherche approfondie du contenu des modules reste nécessaire avant de conclure à une absence fonctionnelle.
- Statut : développé sur branche distante ; **non fusionné dans main, non déployé, CI et exécution réelle non revérifiées dans cet audit**.

### LOT 7 — SAMBA-ADV-01 (planifié, non implémenté par cet audit)
Sources pédagogiques : `S05-Partage_de_fichiers_Samba-A26`, `S05-Formatif_5_Partage_de_fichiers_Samba-A26` et `S05-Exemple_de_partage_dun_dossier_par_groupe`.

1. **Inventaire préalable** : examiner le contenu réel des modules Linux pour identifier les commandes Samba/SMB/NFS déjà présentes et éviter les doublons.
2. **Diagnostic Samba** : statut des services selon le rôle (serveur autonome ou AD-DC), `testparm`, `smbstatus`, réseau et pare-feu, avec scripts de lecture seule.
3. **Partages sécurisés** : générateur de configuration `smb.conf`, utilisateurs/groupes autorisés, lecture/écriture, vérification des droits POSIX/ACL, sauvegarde préalable et tests.
4. **Samba Active Directory** : gestion guidée des comptes, groupes et membres via `samba-tool`, sans mots de passe en clair.
5. **Client SMB** : découverte, connexion et transfert `smbclient` (`get`, `mget`, `put`, `mput`, récursivité) avec avertissements sur les effets.
6. **RAID1 et partages** : scénario transversal de vérification du RAID, montage et partage, sans recréer les assistants RAID existants.
7. **Validation** : tests de génération, analyse statique ShellCheck, contrôles de sécurité, tests négatifs des permissions, CI Linux, puis lab Ubuntu/Windows avant fusion.

### Garde-fous
- Le site GitHub Pages génère des scripts ; il ne les exécute pas.
- Ne pas reprendre `chmod 777`, les partages invités, les mots de passe d'exemple ou l'ouverture générale du pare-feu comme réglages par défaut.
- Ne pas supposer l'existence de `/dev/md127` ni utiliser un UID/GID numérique fixe.
- Ne pas modifier `main`, publier sur Pages ou déclarer PASS un test non exécuté.
- Les modifications effectives du code Samba nécessitent une étape de développement et de validation distincte.
