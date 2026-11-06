# CISCO-S07-01 — Cours Cisco « EtherChannel et Spanning Tree » (semaine 7)

Premier cours de la plateforme **Cisco** dans « Mes cours Cisco ».

## Où c'est classé
| Espace | Emplacement |
|---|---|
| Mes cours Cisco | « Architecture réseau II — Semaine 7 : EtherChannel et Spanning Tree » (`cisco-s07-etherchannel`), 3 parcours A, B, C |
| Aide-mémoire Cisco | groupe « Commutation Cisco » : EtherChannel (6 fiches) et Spanning Tree (3 fiches) |
| Catalogue pro | Réseau Cisco → « EtherChannel et Spanning Tree » (9 fiches) |

## Les 9 fiches (méthode IOS, jamais exécutées)
`cours-ec-avant-de-grouper`, `cours-ec-pagp`, `cours-ec-lacp`, `cours-ec-statique`, `cours-ec-verifier`, `cours-ec-depanner`, `cours-stp-lire`, `cours-stp-racines`, `cours-stp-portfast-bpduguard`.

## Parcours
- **A** — configurer des EtherChannel (exercices 6.2.4 et 6.4.1).
- **B** — vérifier et dépanner (exercice 6.3.4).
- **C** — Spanning Tree : redondance, PVST+, Rapid PVST+ (exercices 3.1.1.5, 3.3.1.5, 3.3.2.2).
Deux éléments sont déclarés **non couverts** : la construction de la topologie dans Packet Tracer et le mode simulation.

## Résumé pliable (rafraîchir la mémoire)
Champ `rappelCours` d'un cours (`cours-resume-cisco.mjs`) : l'essentiel, 7 sections avec schémas, commandes à retenir, pièges, 7 questions à réponse cachée. Plié par défaut ; `#/cours/<id>/resume` l'ouvre ; son état est conservé quand on coche un élément. Chaque fiche porte aussi un `rappel` plié et des `figures`.

## Schémas
8 SVG **originaux** (`schemas-cisco.mjs`), dessinés ici : aucune diapositive n'est copiée. Titre, description, légende, symbole + mot pour chaque état, thèmes clair et sombre, 390 px. Le banc refuse toute image embarquée, lien ou script dans un SVG.

## Tests
`test/cisco-s07.test.mjs` (550 vérifications), `test/browser-cisco-s07.test.mjs` (23), matrices régénérées. Non exécuté : Packet Tracer, commutateur réel.

## À suivre
`TP2_etu.zip` (S06 : VLAN, VTP, SSH, routage inter-VLAN, RIP) est fourni mais pas encore traité.
