# CISCO-COURS-RESEAU-01

Intégration des cours Cisco S01, S02, S03, S05 et du TP2 dans l'application.

## Contenu
- 17 fiches à commande directe (`dist/cours-fiches-cisco-reseau.mjs`), 6 d'entre elles repliées sous un assistant existant (pas de doublon).
- 5 cours : cisco-s01-revision-vlsm, cisco-s02-commutateur-securite, cisco-s02-s03-routage, cisco-s05-vlan-vtp-dtp, cisco-tp2-routage-statique.
- 14 schémas originaux, résumés pliables, 3 groupes d'aide-mémoire.

## Ambiguïtés du TP2 (à confirmer avec l'enseignant)
1. PC2 noté 192.158.5.66 : hors du réseau 192.168.5.64/27, probablement 192.168.5.66.
2. S0/0/0 de R1 et de R3 notées 10.123.145.56 : c'est l'adresse du réseau.
3. Lien R2-R3 (10.123.145.72/29) absent du tableau 1.
4. PC5 et PC6 en .165 et .166 plutôt que les plus basses de la plage.

## Limites
Rien n'a été exécuté sur Packet Tracer ni sur du matériel. Les URL de sources viennent de la mémoire de l'auteur et n'ont pas été ouvertes. Le fichier TP2_etu.zip (S06) n'est pas traité.

## Tests
`npm run test:cisco-reseau`, `npm run test:browser:cisco-reseau`.
