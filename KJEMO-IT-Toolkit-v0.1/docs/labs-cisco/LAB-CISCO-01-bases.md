# Laboratoire Cisco 1 — Manipulation de base d'un commutateur IOS

> **Statut : guide NON EXÉCUTÉ.** Ce laboratoire n'a été joué ni dans Packet Tracer ni sur un
> commutateur réel. Aucun fichier `.pka` n'est fourni. Les résultats sont des *résultats attendus
> à vérifier*, pas des résultats observés. Les commandes sont rapprochées de la documentation Cisco,
> jamais essayées.

## Objectif
Savoir naviguer dans IOS, identifier et sauvegarder un commutateur, préparer l'accès SSH et lire
l'état d'une interface, de la table MAC et de port-security — **en lecture d'abord**.

## Topologie
Un commutateur `SW-LAB-01` (Catalyst 2960 dans Packet Tracer ; référence documentaire :
C1000-24T-4G-L, non testé) et un PC relié à `Fa0/7`. Numérotation à deux nombres (`Fa0/7`) avec un 2960 ;
`Gi1/0/7` avec un Catalyst 1000 : ne pas les mélanger.

## Mots de passe
Aucun mot de passe n'est fourni par ce guide et aucun n'est saisi dans le Toolkit. Choisissez le
vôtre et **tapez-le directement dans la console**. N'utilisez pas le mot de passe d'exemple du cours.

## Parcours (chaque étape : générer le fichier, le lire, coller étape par étape)
1. `cisco-modes-ios` — reconnaître `>`, `#`, `(config)#`, `(config-if)#`. *Attendu :* `enable` mène à `#`, `end` y revient.
2. `cisco-identification` (Lecture) — `show version`, `show inventory`. *Attendu :* modèle et version IOS affichés.
3. `cisco-identification` (Configuration, phrase `CONFIGURER SW-LAB-01`) — nouveau nom d'hôte. *Attendu :* l'invite change.
4. `cisco-interface-etat` — lecture de `Fa0/7`, puis description. *Attendu :* `connected` si le PC est branché.
5. `cisco-gestion-ip` — SVI de gestion VLAN 99. *Attendu :* `ping` de la passerelle réussi seulement si elle existe.
6. `cisco-console-ssh` — prérequis SSH ; compte et clé RSA tapés à la main. *Attendu :* `show ip ssh` indique SSH activé.
7. `cisco-table-mac` — lecture filtrée sur `Fa0/7`. *Attendu :* l'adresse du PC en `DYNAMIC`.
8. `cisco-port-security-etat` puis `cisco-port-security-config` sur `Fa0/7`. *Attendu :* `Port Security : Enabled`.
9. `cisco-config-sauvegarde` (phrase `SAUVEGARDER SW-LAB-01`) — sauvegarde **explicite**, puis comparaison. *Attendu :* running et startup identiques.

## Points de vigilance
- Les modifications vivent en RAM tant que l'étape 9 n'est pas faite : un redémarrage les perd.
- La sauvegarde écrase la startup-config précédente : conservez une copie avant.
- Packet Tracer implémente certaines commandes de façon simplifiée (SSH, port-security) ; notez les écarts.

## Compte rendu à remplir (par vous, après essai)
| Étape | Résultat observé | Écart avec l'attendu |
|---|---|---|
| … | *à remplir* | *à remplir* |
