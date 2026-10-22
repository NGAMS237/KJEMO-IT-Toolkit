# Laboratoire Azure 1 — Contexte, tenant, abonnement et RBAC

> **Statut : guide NON EXÉCUTÉ.** Ce laboratoire n'a été joué sur aucun tenant ni
> abonnement. Les résultats ci-dessous sont des *résultats attendus à vérifier*,
> pas des résultats observés. Les assistants ont été exécutés uniquement contre
> des doublures PowerShell (voir le rapport du LOT 8).

## Objectif

Savoir **où l'on est** avant toute commande : quel tenant, quel abonnement, quels
groupes de ressources, qui a quel rôle, et ce que les rôles Entra et le MFA
permettent de lire. Tout est en **lecture seule**.

## Coûts

Aucun : ce laboratoire ne crée aucune ressource. Une seule réserve de licence :
le rapport d'enregistrement MFA exige Microsoft Entra ID P1 ou P2 ; sans licence,
la lecture est refusée et l'assistant le signale (il ne conclut pas « sain »).

## Prérequis

- Un compte de **laboratoire** (abonnement d'essai ou compte étudiant), jamais un
  tenant de production.
- Modules installés par vous, dans votre session : `Az.Accounts`, `Az.Resources`,
  `Microsoft.Graph.Authentication`, `Microsoft.Graph.Users`, etc. Le Toolkit
  n'installe rien et ne se connecte à rien.
- Connexion ouverte **par vous**, directement dans la console :
  `Connect-AzAccount -Tenant <tenant>` puis, pour la partie Entra,
  `Connect-MgGraph -Scopes <portées lues dans la fiche>`. Aucun mot de passe, secret
  ou jeton ne se saisit dans le Toolkit, ni dans les champs, ni dans les rapports.

## Parcours

1. **`azure-contexte`** — saisissez l'identifiant du tenant et celui de
   l'abonnement attendus. Le script compare ce que la session porte réellement à
   ce que vous attendez. *Attendu :* concordance, ou refus explicite si la session
   pointe ailleurs (le script ne change jamais de contexte : pas de
   `Set-AzContext`).
2. **`azure-abonnements-rg`** — liste les abonnements visibles et leurs groupes de
   ressources. *Attendu :* un tableau d'abonnements ; une liste vide est un
   résultat « incomplet », pas la preuve qu'il n'y a rien.
3. **`azure-rbac`** — affectations de rôles sur l'abonnement, puis sur un groupe
   de ressources (portée `GroupeRessources`, groupe obligatoire dans ce cas).
   *Attendu :* identifiants **tronqués** (8 premiers caractères puis `-****`).
   « Aucune affectation » est classé ATTENTION : cela peut venir d'un droit de
   lecture insuffisant.
4. **`entra-recherche`** — recherche d'un utilisateur ou d'un groupe par début de
   nom. *Attendu :* résultats limités par `azLimite`.
5. **`entra-roles`** — rôles Entra **activés**. Les attributions éligibles (PIM)
   ne sont pas lues.
6. **`entra-mfa`** — enregistrement MFA. *Attendu :* « enregistré » n'est pas
   « exigé » ; données retardées d'environ 36 heures.

## Questions de compréhension

- Pourquoi un tenant et un abonnement différents donnent-ils des résultats
  différents pour la même commande ?
- Quelle différence entre un rôle Entra et un rôle Azure RBAC ?
- Pourquoi une liste vide ne prouve-t-elle jamais l'absence ?

## Erreurs fréquentes

- Se tromper d'abonnement parce que la session en a gardé un autre : c'est le rôle
  de `azure-contexte`.
- Confondre « rôle assigné » et « droit effectif » (héritage, refus, PIM).
- Chercher à coller un secret dans un champ : le Toolkit le refuse.

## Nettoyage

Rien à nettoyer. Fermez la session : `Disconnect-AzAccount`, `Disconnect-MgGraph`.
