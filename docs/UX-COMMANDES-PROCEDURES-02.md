# UX-COMMANDES-PROCEDURES-02 — rapport V2

Deux parcours visés. (1) « Je suis pressé » : la tâche et toute sa procédure sont visibles d'un coup (Vue rapide). (2) « Je veux comprendre » : la même procédure, expliquée étape par étape (Pas à pas). Les deux vues sont calculées depuis la même définition ; un test compare les commandes affichées pour chaque fiche, méthode et jeu de valeurs.

## Modèle
- Méthode `scenario` : équipements déclarés (IOS, PowerShell, CMD, Linux, Azure), étapes rattachées à un équipement et à une phase, hypothèses et topologie obligatoires.
- Les scénarios réutilisent les étapes élémentaires par référence (`reprendre`), garde sur le titre : renommer l'étape source fait échouer la référence.
- Étape : `persistance` (enregistrement séparé), `facultatif`, `dernierRecours`, `interactions` (attente/réponse), ligne `secret` (la commande s'arrête avant le secret ; copie terminée par un espace).
- Paramètre `table` (plan VLAN) avec cohérence : doublons de VLAN/nom, adresse réseau vs préfixe, chevauchement, passerelle et poste dans le sous-réseau, ports uniques, port ≠ trunk.

## Copie
Copie d'une étape, d'une phase, ou de la séquence d'un équipement. Jamais d'invite, de numéro d'étape, de libellé d'équipement ni d'espace réservé. Copie globale refusée avec motif visible : interactif, étapes d'un autre équipement intercalées, plusieurs machines, valeurs manquantes. Aucun mot de passe dans le navigateur, le presse-papiers ou les fichiers (le dossier .md affiche un texte de remplacement).

## Correction technique (VLAN)
vlan.dat porte les VLAN 2–1005 en VTP server/client ; en mode transparent et pour les VLAN étendus (1006–4094) ils sont dans la configuration ; l'affectation des ports et les interfaces ne sont que dans la running-config. `copy running-config startup-config` demande « Destination filename [startup-config]? » : modélisé comme interaction. Sources Cisco non lisibles par l'outil : « non confirmées ».

## Couverture réelle
Voir `docs/UX-COUVERTURE.md` : 39 fiches (dont 4 scénarios), 112 commandes rapides, 211 assistants accessibles, 155 assistants sans fiche courte. Chiffres V1 revérifiés (112 / 56 / 155). Couverture partielle assumée.

## Tests et limites
- Statique : taches 777, scenarios 548 (contrat, vues identiques, persistance VLAN, plans invalides, copie, références, contre-épreuves, dossier).
- Navigateur (Chromium) : browser-taches 120, browser-scenarios 31 ; anciens bancs verts (identité 8553, LOT 7 2274, Cisco 1028, Azure 810, intégration 257, impression 319, poste B 418).
- NON exécutés : PowerShell 5.1, équipements Cisco réels/Packet Tracer, Ubuntu réel, CI GitHub. Aucune commande exécutée sur équipement, tenant, imprimante ou poste réel.
- Non développé : variante commutateur L3 du routage inter-VLAN.


## V2b — Vue rapide finalisée, CMD vérifié, livraison réparée

Base : `bf73ef4` (= origin/main, ancêtre de la V2 `de75d22`). Branche `claude/ux-commandes-procedures-02b`.

### Vue rapide : séquence lisible et compacte
Une carte par phase d'exécution (équipement ET phase, ordre réel conservé) ; blocs de commandes continus ; précautions de la phase avant les commandes ; pauses (réponse, secret) signalées en une ligne ; un bouton Copier par segment (un segment s'arrête après chaque pause et ne mélange jamais deux équipements) ; copie par phase et par équipement conservées avec leur raison de refus en quelques mots ; hypothèses repliées ; aide des champs affichée au focus. Les numéros d'étapes sont ceux du Pas à pas. Le Pas à pas est inchangé (étapes numérotées, explications, mode, résultat attendu, dépannage, sources).

### Hauteur de la Vue rapide (px), mêmes valeurs d'exemple, thème sombre, 1280×900 puis 390×800

| Cas | V2 (1280) | V2b (1280) | Δ | V2 (390) | V2b (390) | Δ |
|---|---|---|---|---|---|---|
| SSH Cisco (scénario) | 4362 | 3395 | -22 % | 6970 | 5079 | -27 % |
| Inter-VLAN (scénario) | 6051 | 4898 | -19 % | 9891 | 8092 | -18 % |
| IP fixe Windows, PowerShell (procédure) | 1547 | 1474 | -5 % | 2341 | 2308 | -1 % |
| Diagnostic réseau Windows (scénario) | 1922 | 1636 | -15 % | 2895 | 2279 | -21 % |
| SSH Linux (scénario) | 3751 | 2963 | -21 % | 5935 | 4313 | -27 % |
| Voir l’IP sous Linux (procédure) | 903 | 840 | -7 % | 1281 | 1090 | -15 % |

Protocole identique des deux côtés (`/tmp` script de mesure rejoué sur le HEAD V2 puis sur V2b ; captures dans `captures-comparatives/`). Le nombre de commandes affichées est inchangé (SSH Cisco 22, inter-VLAN 45, SSH Linux 15, diagnostic 6, Linux IP 3) ; la fiche IP fixe passe de 5 à 6 commandes (étape DNS ajoutée, voir ci-dessous) et son champ DNS, ce qui explique une réduction plus faible. Le texte n'est pas réduit (≥ 12,5 px) et aucune commande n'est masquée. Gain modeste sur les procédures simples (une carte de commandes et une carte de vérification, déjà courtes) ; il est surtout réel sur les scénarios.

### Méthodes CMD
14 méthodes inventoriées (`docs/UX-METHODES-CMD.md`), banc `test/cmd-methodes.test.mjs`. Défauts trouvés et corrigés : repère `<PID>` copiable ; IP fixe sans DNS (la documentation exige un DNS statique) avec retour exact adresse et DNS ; `netstat -p tcp` limité à IPv4 ; `%` et `^` non refusés dans les noms ; trois commandes rapides LOT 7 avec repère littéral. Ajout : journal Windows en CMD (`wevtutil qe`). Lacune assumée : espace disque (pas d'équivalent CMD sûr).

### Livraison
Patch `format-patch` limité aux commits UX depuis `bf73ef4` (à appliquer avec `git am`), diff brut (à appliquer avec `git apply`), bundle complet de la branche, manifeste et SHA-256. Vérifiés dans un clone neuf (voir MANIFEST).
