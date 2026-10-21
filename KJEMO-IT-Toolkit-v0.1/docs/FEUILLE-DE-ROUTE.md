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
| LOT 7 | Linux, Bash, Samba, NFS : 46 assistants (43 Linux + 3 jonction de domaine), 112 commandes rapides, 19 familles de tests négatifs | développé localement, testé localement (Bash réel + doublures, Chromium réel) — **non poussé, non testé en CI, non fusionné, non déployé, non testé sur Ubuntu Server réel** |

L'état exact des LOTS 6A et 6B au moment de leur livraison est consigné dans
leurs rapports respectifs, section « État du push, de la fusion et du
déploiement ». Aucun des deux n'a été exécuté sur un poste Windows réel.

## Lots prévus, non commencés

Les lots ci-dessous sont **consignés, pas développés**. Aucun code, aucune
fiche, aucun test ne leur correspond dans le dépôt. Ils ne sont pas des
sous-rubriques d'un lot existant : en particulier, **Bash, Samba et Azure ne
sont pas des catégories du LOT 6B**, et ne doivent pas y être ajoutés.

### LOT 6C — Correctif de la dette 6B (consigné, non commencé)
18 assistants et 144 scripts du LOT 6B portent un sélecteur « Format du
rapport » qui ne commande rien (valeur lue, jamais utilisée). Le LOT 7 les
**détecte et les liste** (`npm run test:dette-6b`) sans modifier les 856 scripts
de référence. Le correctif réclame de nouvelles empreintes : c'est un lot à part.

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


## Consolidation du 21 octobre 2026 — transfert V2 LOT 7 / LOT 6C

Cette section est un état de coordination et **ne vaut ni fusion, ni déploiement, ni certification des tests**. Les états historiques plus haut sont conservés pour traçabilité.

### État GitHub vérifié
- Branche distante LOT 7 : `claude/lot-7-linux-bash-samba-nfs`, commit `8626a206d39a160955311e54a80d165810d80f48` avant cette consolidation ; 21 commits devant `main`, aucun derrière.
- `main` : `aff0f7a146076f2ee1cf1e621efdde775ea3e9e2` lors de la vérification.
- Le correctif LOT 6C V2 est **fourni sous forme de livraison locale**, non publié dans une branche distante identifiée lors de la vérification. Commit annoncé dans les artefacts : `7dd1304027554ccb77d9c870c9470e853e5f478a`, basé sur `2deb49ee50e3f51e8dc6a6bf8df02b02b366a99f`, tree annoncé `9e4b1605a0123db0633193a04880ad17fa9ebdc9`.
- Le rapport de livraison V2 annonce 35 commandes de test au code 0 dans un clone neuf, mais **Windows réel, Windows PowerShell 5.1, Robocopy réel et GitHub Actions non exécutés**. Ne pas assimiler ces résultats déclarés à une CI distante vérifiée.
- La livraison locale LOT 7 et la branche LOT 7 distante doivent être comparées et réconciliées ; conserver l'actualisation SAMBA-ADV-01 et toute implémentation Samba existante avant de développer de nouveaux assistants.

### Portes de sortie avant LOT 8
1. Comparer les arbres et historiques du LOT 7 local et distant ; inventaire réel des commandes et tests Samba ; résoudre les écarts sans écrasement.
2. Publier le LOT 7 sur branche de travail, vérifier les CI GitHub, réaliser la revue, puis fusionner par merge commit après validation.
3. Revoir le LOT 6C V2 : garde des simulations, mentions Robocopy et contre-épreuves ; publier sa branche, vérifier CI, puis fusionner après validation.
4. Vérifier le déploiement GitHub Pages et les liens/fiches générés ; distinguer contrôles automatiques et tests manuels Windows/Ubuntu encore à faire.
5. Mettre à jour les références des commits et les statuts des lots **après** les fusions réelles, sans les anticiper.

### LOT 8 — Azure / Microsoft Entra ID (prochain gros lot, planifié)
- **Identités et accès** : utilisateurs, groupes, rôles Azure RBAC, moindre privilège, Entra ID, MFA et bonnes pratiques d'administration.
- **Compute** : machines virtuelles Azure, états, tailles, disques, diagnostics et nettoyage guidé des ressources de lab.
- **Réseau** : VNets, sous-réseaux, NSG, IP, DNS, connectivité et diagnostics.
- **Stockage et protection** : comptes de stockage, accès, sauvegarde et restauration guidée.
- **Observabilité et coûts** : Azure Monitor, journaux, alertes, inventaire, budgets et prévention des dépenses involontaires.
- **Scripts et pédagogie** : Azure CLI / Az PowerShell, prérequis, risques, modes simulation ou lecture seule lorsque possibles, fiches pas-à-pas et labs progressifs.
- **Qualité** : tests des générateurs, validation statique, aucune commande destructive exécutée automatiquement, pas de secrets dans les scripts, vérifications sur compte de lab avant toute promesse de compatibilité réelle.
- **Statut** : planifié, **non commencé, non fusionné, non déployé**.

### Lots suivants (maintenus)
- LOT 9 : imprimantes.
- LOT 10 : analyse avancée des disques, sans doublon de `disk-scan`.
- LOT 11 : rapports, bilingue, sécurité et qualité transversales.
- LOT 12 : exécution locale facultative, sous réserve d'une étude d'architecture et de sécurité préalable.

**Règle de coordination :** ne jamais déclarer « terminé », « PASS », « fusionné » ou « déployé » sans preuve correspondante ; ne pas modifier `main` directement pour cette consolidation documentaire.
## Navigation et fiche cibles — consignées, non implémentées

La hiérarchie cible à quatre niveaux (Microsoft Windows ; Linux et services
réseau ; Réseau et Cisco ; Cloud et outils multiplateformes) et le modèle de
fiche cible (onglets CMD/PowerShell/GUI, copie impossible tant qu'un
placeholder subsiste, etc.) sont décrits dans
[`ARCHITECTURE-MULTIPLATEFORME.md`](ARCHITECTURE-MULTIPLATEFORME.md). Aucune
ligne de code ne les réalise ; les identifiants et routes existants sont
préservés.

## Observations du LOT 7 non corrigées (volontairement)

- Netplan (corrigé au 27/n, voir le CHANGELOG) : `50-cloud-init.yaml` n'a
  jamais été le nom proposé (le défaut est `99-kjemo-reseau.yaml`) ; il
  n'apparaissait que dans un message et une erreur courante, mais le formulaire
  l'acceptait. La passerelle égale à l'hôte, au réseau ou à la diffusion était
  acceptée. Les deux sont refusées.
- `networking.service` : le script en parle mieux que le formulaire.
- Point de montage contenant des espaces ou `;` : refusé par prudence.
- Les commandes rapides ne sont affichées par aucun écran.
- Copie du bandeau d'accueil écrite pour Windows seulement.
- Le bouton retour passe à la ligne à 390 px ; les liens de sources de moins de
  24 px sont exemptés de la règle WCAG 2.5.8.
- N19 (jonction PowerShell) est éprouvée statiquement (niveau 1), pas exécutée.
- `chown` et `mknod` réels ne sont exécutables que si la capacité existe.
