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
diagnostics cloud. **Mis à jour le 22 octobre 2026 : développé et testé
localement sur la branche `claude/lot-8-azure-entra-id`** (24 assistants) ; voir
la section « Actualisation du 22 octobre 2026 — LOT 8 » plus bas pour l'état
exact. Non poussé, non testé en CI GitHub, non fusionné, non déployé.

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
- **Statut (mis à jour le 22 octobre 2026)** : **développé et testé localement** sur `claude/lot-8-azure-entra-id`, **non fusionné, non déployé, non testé en CI GitHub**. Le paragraphe précédent est le périmètre initial ; ce qui est réellement livré est décrit dans `LOT-8-RAPPORT.md`.

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

## Actualisation du 21 octobre 2026 — Réseau et Cisco : RESEAU-CISCO-01

**Décision : chantier inscrit à la roadmap, planifié, non développé et non testé.**
Il appartient au volet « Réseau et Cisco » de l’architecture cible. Il est distinct
du LOT 8 Azure / Entra ID, dont la mission a été transmise à Claude ; aucune
livraison de code LOT 8 n’est attestée par cette actualisation. Les numéros et
périmètres des LOTS 9 à 12 restent inchangés. Aucun numéro de lot supplémentaire
ni calendrier n’est fixé ici.

### Origine et état de départ

- Cours du 21 octobre : `420-FBL-LI_-_S05_-_Evolutivite_des_VLANs_DTP_VTP.pptx`,
  `420-FBL-LI_-_S05_-_Formatif_06.zip` et synthèse `Markdown collé(1).md`.
- Le calculateur `ipv4-subnet-calculator` existe déjà : le réutiliser, sans le dupliquer.
- Au contrôle du code, aucun assistant dédié VLAN, trunk, DTP ou VTP n’a été
  repéré dans les modules du Toolkit. La rubrique cible « Réseau et Cisco »
  constitue une intention d’architecture, pas une implémentation.
- Cette inscription documentaire ne modifie aucun générateur, aucune commande
  ni aucun statut de fusion ou de déploiement des lots en cours.

### Périmètre à développer, par priorité

1. **VLAN et ports access — priorité haute.** Inventorier les VLAN, préparer
   leur création et leur nommage, affecter un port à un VLAN existant, distinguer
   la base VLAN de l’affectation locale des interfaces. Vérifications avant/après.
2. **Trunks — priorité haute.** Préparer une liaison explicite, vérifier son état
   opérationnel, les VLAN autorisés et le VLAN natif ; diagnostiquer les écarts
   entre extrémités et les VLAN qui ne traversent pas la liaison.
3. **Diagnostic guidé — priorité haute.** Parcours distincts : « trunk absent »,
   « VLAN non transporté », « VLAN présent mais PC injoignable » et « VLAN non
   propagé ». Relier chaque hypothèse aux commandes de lecture et aux résultats
   attendus, sans prétendre avoir interrogé le switch depuis le site.
4. **DTP — priorité pédagogique.** Fiches et simulation des combinaisons
   `dynamic auto`, `dynamic desirable`, `access` et `trunk`. Distinguer le
   laboratoire de négociation DTP des configurations explicites, avec
   `nonegotiate` lorsque le matériel et le scénario le permettent.
5. **VTP — priorité administration et prévention des incidents.** Diagnostic des
   modes, domaine, version, authentification et numéro de révision ; expliquer
   ce qui est propagé et ce qui reste local. Le périmètre pédagogique initial
   porte sur VTP v1/v2 ; VTP v3 doit être traité séparément si ajouté.
6. **Raccordement d’un switch — contrôle préalable.** Checklist de lecture de la
   configuration et de la révision VTP avant connexion à un domaine existant,
   sauvegarde de l’état et identification des risques de propagation.

### Laboratoire de référence

Préparer un exercice reproductible dans Packet Tracer avec DS1, AS1 et AS2 :
DS1 Fa0/7 vers AS1 Fa0/7, DS1 Fa0/9 vers AS2 Fa0/9 ; domaine de laboratoire
`CCNA-LAB`, VLAN 10/20/30/40/50. Vérifier la formation des trunks, la propagation
VTP et, séparément, l’affectation des ports access. Prévoir des pannes injectées
(auto/auto, domaine différent, VLAN non autorisé sur trunk) et leur diagnostic.
Ne pas intégrer le mot de passe d’exemple du cours dans les modèles par défaut.

### Contrat de sécurité et critères de validation

- Génération de commandes et procédures uniquement : aucune connexion distante
  ni application automatique aux équipements.
- Diagnostic en lecture seule par défaut ; cible et interface explicitement
  sélectionnées, sauvegarde et confirmation pour toute modification proposée.
- Pas de suppression de VLAN, d’effacement de `vlan.dat`, de remise à zéro de
  configuration ni de modification globale des ports comme étape automatique.
- Ne pas remplacer silencieusement une liste de VLAN autorisés sur un trunk.
- Ne pas copier les paramètres du laboratoire comme configuration de production.
  Vérifier les commandes selon le modèle et la version IOS, notamment la
  différence entre `Fa0/x` et `Gi1/0/x`.
- Tests des champs, de la génération, des refus, de la copie et du téléchargement ;
  contre-épreuves et non-régression du catalogue existant.
- Distinguer tests de génération, simulation Packet Tracer et équipement physique.
  Aucun de ces niveaux ne vaut preuve d’exécution d’un autre.
- Fournir des résultats attendus pour `show vlan brief`, `show interfaces trunk`,
  `show interfaces <interface> switchport` et `show vtp status`.
- Sources : cours fournis et documentation officielle Cisco adaptée au matériel,
  dont [Configuring VTP — précautions sur les révisions v1/v2](https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3850/software/release/3se/vlan/configuration_guide/b_vlan_3se_3850_cg/b_vlan_3se_3850_cg_chapter_011.html).

**Condition de clôture :** inventaire sans doublons, assistants et laboratoire
livrés, tests exécutés avec preuves, puis revue et intégration distinctes.
L’inscription à la roadmap seule ne constitue pas une livraison.

## Actualisation du 22 octobre 2026 — LOT 8 : Azure et Microsoft Entra ID

**Statut : développé localement, testé localement. NON poussé, NON testé en CI
GitHub, NON fusionné, NON déployé.** Base : `78a2c8b` (roadmap RESEAU-CISCO-01) sur
`reconciliation/lot7` @ `78a2c8b9` ; la PR n° 7 du LOT 7 est ouverte, non fusionnée.
Les inscriptions Samba et RESEAU-CISCO-01 ci-dessus sont conservées telles quelles.

- **Livré (localement)** : 24 assistants Azure / Entra ID en six familles
  (Connexion, contexte et accès · Microsoft Entra ID · Machines virtuelles ·
  Réseau Azure · Stockage et protection · Surveillance et coûts), catégorie
  « Azure et Entra ID », sortie PowerShell `.ps1` pour Windows PowerShell 5.1 et
  PowerShell 7. 21 en lecture seule ; 3 agissent (`azure-vm-demarrage`,
  `azure-vm-arret`, `azure-sauvegarde-restauration`) après prévisualisation
  `-WhatIf` et phrase de confirmation exacte.
- **Jamais de connexion** : les scripts n'appellent ni `Connect-*`, ni
  `Set-AzContext`, ni `Select-AzSubscription`. Aucune clé, aucun SAS, aucun secret.
- **Testé localement** : banc Azure (scripts exécutés contre des doublures
  PowerShell 7), banc navigateur Playwright dédié, identité des 177 outils,
  matrices LOT 8, sources Microsoft vérifiées en ligne.
- **NON exécuté** : Windows PowerShell 5.1 (analyse syntaxique seulement ; étape
  ajoutée au job Windows de la CI, jamais jouée), tenant ou abonnement Azure réel,
  CI GitHub. Les doublures ne valent pas validation sur un vrai tenant.
- **Reste à faire** : revue, publication de la branche, CI distante, essai en
  laboratoire sur un compte d'essai, PR et fusion distinctes.
- **Garde historique** : les 440 scripts (SHA `4c37ce2`) et les 712 scripts
  (SHA `803870c`) antérieurs sont identiques octet par octet ; la baseline des 856
  scripts est inchangée ; les matrices LOT 7 gardent leur périmètre.
- **Laboratoires** : `docs/labs-azure/` (trois guides, NON EXÉCUTÉS).


## Actualisation du 22 octobre 2026 — RESEAU-CISCO-01 : développé localement

**État : développé et testé LOCALEMENT sur la branche `claude/reseau-cisco-01` (base `78a2c8b`). Non poussé (accès GitHub refusé depuis la session), non testé en CI distante, non fusionné, non déployé. Packet Tracer et commutateur réel : NON EXÉCUTÉ.** Les numéros et périmètres des LOTS 9 à 12 sont inchangés ; le LOT 9 Imprimantes n’est pas commencé.

### Socle Cisco (développé AVANT les VLAN)

Neuf assistants qui précèdent tout travail VLAN/trunk/VTP :

1. `cisco-modes-ios` — modes, invites, aide, complétion, erreurs de contexte ;
2. `cisco-identification` — nom d’hôte, bannière, lecture matériel/version ;
3. `cisco-console-ssh` — comptes locaux, prérequis SSH par matériel, lignes vty ; mots de passe et génération de clé à taper à la main ;
4. `cisco-config-sauvegarde` — running/startup-config, différences, sauvegarde explicite et vérifiée ;
5. `cisco-interface-etat` — état, description, activation ciblée d’UNE interface ;
6. `cisco-gestion-ip` — adresse de gestion (SVI), passerelle niveau 2 ou routage, ping ;
7. `cisco-table-mac` — lecture filtrée, effacement dynamique ciblé (jamais général) ;
8. `cisco-port-security-etat` — état, adresses, violations, diagnostic d’un port bloqué ;
9. `cisco-port-security-config` — configuration ciblée, remise en service d’UN port.

### VLAN, trunks, DTP, VTP (dix assistants)

`cisco-vlan-inventaire`, `cisco-vlan-creation`, `cisco-port-access`, `cisco-trunk-preparation` (add/remove seulement, jamais de remplacement de liste), `cisco-trunk-diagnostic`, `cisco-dtp-simulation`, `cisco-vtp-diagnostic`, `cisco-vtp-configuration` (v1/v2, mot de passe à la main), `cisco-vtp-raccordement` (liste de contrôle), `cisco-parcours-diagnostic` (quatre parcours + analyse de sorties collées).

### Reste hors périmètre (volontairement)

VTP v3 ; suppression de VLAN ; effacement de `vlan.dat` ; remise à zéro ; STP, EtherChannel, OSPF, ACL, routage inter-VLAN ; connexion ou exécution distante (LOT 12, sous étude préalable) ; LOT 9 Imprimantes.

### Laboratoires

Trois guides dans `docs/labs-cisco/` (manipulation de base ; VLAN, ports d’accès, trunks ; DTP, VTP et incidents). Aucun fichier `.pka`, aucun résultat observé : tout est **NON EXÉCUTÉ** et les résultats sont « attendus à vérifier ».

### Condition de clôture (inchangée)

Revue et intégration distinctes ; essai Packet Tracer puis, si possible, matériel réel ; CI distante. Voir `RESEAU-CISCO-01-RAPPORT.md`.


## Actualisation du 22 octobre 2026 — Intégration Azure + Cisco

- Branche d'intégration `claude/integration-azure-cisco` : LOT 8 (`8633b46`) + RESEAU-CISCO-01 (`5168d9e`), base commune `78a2c8b`. **Développé et testé localement ; non poussé, CI distante non exécutée, non fusionné dans main, non déployé.**
- Catalogue : 196 assistants (153 + 24 + 19), 10 catégories canoniques, Imprimantes encore vide (LOT 9 non commencé au moment de ce checkpoint).
- Le LOT 9 Imprimantes part de ce checkpoint sur une branche distincte ; il ne modifie pas ce checkpoint.
- Rapport : `INTEGRATION-AZURE-CISCO-RAPPORT.md`.
