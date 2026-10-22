# Laboratoire Cisco 2 — VLAN, ports d'accès, trunks et transport des VLAN

> **Statut : guide NON EXÉCUTÉ.** Ni Packet Tracer ni équipement réel. Aucun `.pka`. Résultats = *attendus à vérifier*.

## Objectif
Créer les VLAN 10/20/30/40/50, affecter des ports d'accès, préparer le trunk DS1–AS2 et diagnostiquer un VLAN qui ne traverse pas la liaison.

## Topologie
DS1 `Fa0/7` ↔ AS1 `Fa0/7` ; DS1 `Fa0/9` ↔ AS2 `Fa0/9`. Un PC par VLAN sur AS1 et AS2 (ports d'accès hors liens inter-commutateurs).
Plan : VLAN 10 RH, 20 Compta, 30 Ventes, 40 Direction, 50 Invités.

## Parcours
1. `cisco-vlan-inventaire` sur chaque commutateur. *Attendu :* VLAN 1 et 1002–1005 seulement avant création.
2. `cisco-vlan-creation` (phrase `CONFIGURER VLAN 10`, etc.) sur DS1. *Attendu :* chaque VLAN `active` dans `show vlan brief`. Aucune suppression n'est proposée.
3. `cisco-port-access` — un poste dans chaque VLAN. *Attendu :* `Access Mode VLAN: N`.
4. `cisco-trunk-preparation` sur DS1 `Fa0/9` : **ajouter** `10,20,30`. *Attendu :* `show interfaces trunk` liste ces VLAN dans « allowed ».
5. Faute pédagogique : ajouter seulement `10,20` puis tester un poste du VLAN 30.
6. `cisco-parcours-diagnostic` « VLAN non transporté » : collez `show interfaces trunk` ; l'analyse doit signaler que le VLAN 30 n'est pas autorisé. Corrigez avec `allowed vlan add 30`.
7. Natif : alignez le VLAN natif des deux côtés (`cisco-trunk-diagnostic` des deux commutateurs). *Attendu :* aucun message de désaccord de natif.

## Pièges à constater
- `allowed vlan 10,20` sans `add` **remplace** toute la liste : l'assistant ne le génère jamais.
- Un port d'accès dans un VLAN inexistant est inactif.
- `show vlan brief` ne liste pas les ports en trunk.

## Compte rendu à remplir par l'étudiant
| Étape | Observé | Écart |
|---|---|---|
| … | *à remplir* | *à remplir* |
