# Laboratoire Azure 3 — Stockage, sauvegarde, surveillance et coûts

> **Statut : guide NON EXÉCUTÉ.** Rien n'a été créé, restauré ni supprimé sur Azure
> par ce guide. Les résultats sont des attentes à vérifier, pas des observations.

## Objectif

Évaluer l'exposition d'un compte de stockage, l'état de la protection par
sauvegarde, ce qui est surveillé, ce que l'on dépense, et repérer des ressources de
laboratoire oubliées — sans jamais lire une clé, un jeton SAS ou un contenu.

## Coûts — à lire AVANT toute création

Les assistants de lecture sont gratuits. Pour s'exercer, vous pouvez créer **vous-même**
(hors Toolkit) un compte de stockage, un coffre de sauvegarde et un budget :

- le **stockage** est facturé à la capacité et aux opérations tant qu'il existe ;
- une **sauvegarde** est facturée à la consommation (instance protégée + stockage
  des points de récupération) ;
- une **restauration** crée des disques et des fichiers de transit, facturés tant
  qu'ils existent, et peut entraîner des frais de lecture de sauvegarde ;
- les **alertes** et l'export de journaux vers Log Analytics ont un coût lorsqu'ils
  sont créés.

Estimez avec la calculatrice officielle avant de créer, puis **créez le budget
d'alerte en premier**. Rappel : un budget alerte, il ne bloque rien. La dépense
affichée a du retard et n'est pas la facture.

## Parcours

1. **`azure-budgets`** — budgets de l'abonnement. *Attendu :* liste et seuils ; un
   résultat vide ne prouve pas l'absence de budget (certains types d'offre ne sont
   pas couverts).
2. **`azure-stockage-inventaire`** — comptes de stockage du groupe.
3. **`azure-stockage-exposition`** — **un** compte : accès réseau, accès public aux
   conteneurs, protections. *Aucune clé, aucun SAS, aucun contenu n'est lu* ; les
   jetons SAS déjà émis ne se listent pas.
4. **`azure-sauvegarde-coffres`** — coffres Recovery Services, éléments de
   sauvegarde de VM (état, dernière sauvegarde, stratégie) et VM sans protection ;
   ancienneté mesurée avec `azJours`. Aucune restauration n'est testée : un statut
   « Completed » ne prouve pas que les données se relisent.
5. **`azure-sauvegarde-restauration`**, mode `Diagnostic` uniquement dans ce
   laboratoire : `Restore-AzRecoveryServicesBackupItem -WhatIf`. Les garde-fous
   sont vérifiés dès le formulaire : groupe cible **différent** du groupe source,
   nom de cible contenant lab/test/restore/restauration/sandbox/labo, compte de
   transit dans la région du coffre. La phrase d'application serait
   `RESTAURER <vm> VERS <groupe-cible>`. *Ne passez en `Appliquer` que dans un
   laboratoire dont vous avez accepté le coût.* Seuls les **disques** sont
   restaurés, pas une machine complète.
6. **`azure-journal-activite`** — opérations de gestion récentes, filtrables par
   statut (fenêtre `azHeures`). Conservation de 90 jours ; rien sur le contenu des
   machines ni sur l'accès aux données.
7. **`azure-alertes-diagnostics`** — règles d'alerte et paramètres de diagnostic.
   Inventaire de configuration : il ne teste ni les seuils ni l'envoi des messages.
8. **`azure-ressources-inutilisees`** — candidats à l'inutilité parmi les disques,
   cartes réseau, adresses IP publiques, machines et instantanés du périmètre
   (ancienneté des instantanés selon `azJoursSnapshot`).
   **Un candidat n'est pas une preuve d'inutilité.**

## Nettoyage ciblé

Aucun assistant ne supprime quoi que ce soit, et le nettoyage global automatique
est volontairement exclu. Méthode manuelle, par vous, dans l'ordre : (1) relire la
sortie de `azure-ressources-inutilisees` ; (2) pour chaque candidat, vérifier
dans le portail qu'il vous appartient et qu'aucune VM ne l'utilise ; (3) supprimer
**une** ressource à la fois, ou le groupe dédié que vous avez créé pour ce
laboratoire après en avoir listé le contenu ; (4) relire `azure-budgets` le
lendemain pour vérifier que la dépense cesse de croître.

## Questions de compréhension

- Pourquoi un budget n'est-il pas un plafond ?
- Pourquoi la restauration vers le groupe source est-elle refusée ?
- Pourquoi « aucun point à examiner » ne signifie-t-il pas « tout va bien » ?
