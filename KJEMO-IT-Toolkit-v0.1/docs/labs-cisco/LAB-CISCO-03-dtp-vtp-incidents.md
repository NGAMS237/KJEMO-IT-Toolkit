# Laboratoire Cisco 3 — DTP, VTP et prévention des incidents

> **Statut : guide NON EXÉCUTÉ.** Ni Packet Tracer ni équipement réel. Aucun `.pka`. Résultats = *attendus à vérifier*.
> Le mot de passe d'exemple du cours n'est **pas** utilisé : choisissez le vôtre et tapez-le à la main.

## Topologie
DS1 `Fa0/7` ↔ AS1 `Fa0/7` ; DS1 `Fa0/9` ↔ AS2 `Fa0/9`. Domaine VTP `CCNA-LAB` ; VLAN 10/20/30/40/50 ; DS1 serveur, AS1 et AS2 clients (VTP version 1 ou 2 ; la version 3 n'est pas couverte).

## Partie A — DTP (formation des trunks)
1. `cisco-dtp-simulation` : prédire pour chaque combinaison (auto/auto, auto/desirable, desirable/desirable, trunk/auto, access/trunk, trunk-nonegotiate/auto).
2. Configurer réellement les modes sur DS1 `Fa0/7` et AS1 `Fa0/7`, puis `show interfaces trunk` des deux côtés. *Attendu (modèle d'enseignement) :* auto/auto → pas de trunk ; auto/desirable → trunk ; trunk/access → liaison incohérente.
3. Comparer la simulation et la réalité ; noter tout écart (Packet Tracer ≠ matériel).
4. Préférer ensuite la configuration explicite (`cisco-trunk-preparation`, éventuellement `nonegotiate`).

## Partie B — VTP
1. `cisco-vtp-diagnostic` sur les trois commutateurs : noter mode, domaine, version, **révision**.
2. `cisco-vtp-configuration` : DS1 serveur, AS1/AS2 clients, domaine `CCNA-LAB`, même version. (Cochez la lecture de la révision.)
3. Créer le VLAN 50 sur DS1 uniquement. *Attendu :* il apparaît sur AS1 et AS2 ; la révision augmente.

## Partie C — Incidents injectés (diagnostic avec `cisco-parcours-diagnostic`)
| Panne injectée | Symptôme attendu | Parcours |
|---|---|---|
| auto/auto sur le lien | pas de trunk | trunk absent |
| domaine `ccna-lab` (casse) sur AS2 | VLAN non propagé vers AS2 | VLAN non propagé |
| VLAN 30 absent de `allowed vlan` | PC du VLAN 30 isolés | VLAN non transporté |
| mode transparent sur AS1 | VLAN non reçus sur AS1 | VLAN non propagé |
| port d'accès dans le mauvais VLAN | PC injoignable malgré VLAN présents | PC injoignables |

## Partie D — Raccordement prudent
Avant de brancher un cinquième commutateur de laboratoire (ancien, révision élevée) : `cisco-vtp-raccordement`. *Attendu :* lire la révision lien débranché, la ramener à 0 (transparent puis client, à confirmer par `show vtp status`), puis raccorder. **Ne jamais** brancher d'abord.

## Compte rendu à remplir par l'étudiant
| Panne | Diagnostic fait | Correction | Écart avec l'attendu |
|---|---|---|---|
| … | *à remplir* | *à remplir* | *à remplir* |
