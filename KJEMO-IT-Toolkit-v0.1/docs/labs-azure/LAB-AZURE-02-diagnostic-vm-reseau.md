# Laboratoire Azure 2 — Diagnostic d'une machine virtuelle et du réseau Azure

> **Statut : guide NON EXÉCUTÉ.** Aucune machine n'a été créée, démarrée ni arrêtée
> par ce guide. Les résultats sont des attentes à vérifier, pas des observations.

## Objectif

Lire l'état d'une VM de laboratoire, ses disques et interfaces, puis comprendre le
réseau autour d'elle (VNet, adresses IP, NSG, DNS), et s'exercer au **cycle
Diagnostic → Appliquer** des deux assistants qui agissent (démarrer, arrêter).

## Coûts — à lire AVANT de créer quoi que ce soit

Les assistants de lecture ne coûtent rien. Mais pour s'exercer il faut une VM de
laboratoire, et **c'est vous qui la créez, hors du Toolkit** :

- une VM **démarrée** est facturée pour le calcul, à l'heure ;
- une VM **arrêtée mais non désallouée** est *encore facturée* pour le calcul ;
- une VM **désallouée** n'est plus facturée pour le calcul, mais ses **disques**,
  ses **IP publiques statiques** et ses **sauvegardes** continuent de l'être.

Les tarifs changent selon la région et la taille : estimez avant de créer avec la
calculatrice officielle de tarification Azure, choisissez la plus petite taille
adaptée, et créez un budget d'alerte (laboratoire 3). Un budget **alerte** mais ne
**plafonne pas** la dépense.

## Prérequis

Ceux du laboratoire 1, plus : une VM de laboratoire dans un groupe de ressources
dédié (ex. `rg-lab`), nom de VM contenant « lab ». Rôle suffisant pour lire ; pour
démarrer/arrêter : action `start/action` ou `deallocate/action` sur la machine.

## Parcours — lecture

1. **`azure-vm-inventaire`** — VM du groupe, état d'alimentation, taille, région.
2. **`azure-vm-etat`** — configuration, état d'alimentation, agent invité et
   extensions d'**une** VM, et dernières opérations du journal d'activité
   (fenêtre `azHeures`). L'état de l'agent n'est publié que pour une machine
   démarrée. Un état inconnu est classé ATTENTION, jamais OK.
3. **`azure-vm-disques-interfaces`** — disques et interfaces réseau de la VM.
4. **`azure-reseau-vnets`** — réseaux virtuels, plages, sous-réseaux, appairages et
   serveurs DNS ; chevauchements de plages **IPv4** signalés (IPv6 non couvert ;
   les itinéraires effectifs ne sont pas calculés).
5. **`azure-reseau-interfaces-ip`** — interfaces et IP (publiques, privées).
6. **`azure-reseau-nsg`** — règles personnalisées d'**un** NSG nommé et leurs
   associations ; règles ouvertes à Internet signalées. L'ordre de priorité n'est
   **pas** évalué : une règle Deny plus prioritaire peut neutraliser une règle
   Allow signalée.
7. **`azure-reseau-dns`** — zones DNS privées et publiques du groupe et leurs liens
   de réseau, puis résolution d'un nom et test TCP vers un port choisi (liste
   fermée de ports). *La résolution et le test partent de **votre poste**, pas
   d'Azure :* ils ne prouvent pas qu'une VM atteint un service, et un délai
   dépassé ne dit pas pourquoi. Network Watcher n'est pas utilisé.

## Parcours — actions confirmées (VM de laboratoire uniquement)

1. **`azure-vm-demarrage`**, mode `Diagnostic` : le script exécute
   `Start-AzVM -WhatIf` (prévisualisation réelle de la commande). *Attendu :*
   aucune modification.
2. Passez en mode `Appliquer` : le champ de confirmation exige la phrase exacte
   `DEMARRER <nom-de-la-vm>` (majuscules comprises). Une phrase fausse est refusée
   dès le formulaire et par le script.
3. **`azure-vm-arret`** : même cycle avec `ARRETER <nom-de-la-vm>`, choix
   `Desallouer` (recommandé : stoppe la facturation du calcul) ou
   `SansDesallocation`. Il n'y a **pas de `-Force`** : l'invite native de
   `Stop-AzVM` sert de seconde confirmation. Un arrêt ne laisse pas aux
   utilisateurs le temps de finir.

## Questions de compréhension

- Pourquoi une VM « Arrêtée » peut-elle coûter autant qu'une VM démarrée ?
- Pourquoi une règle NSG « ouverte à Internet » n'est-elle pas forcément fautive ?
- Que prouve (et ne prouve pas) un test TCP depuis votre poste ?

## Nettoyage

Les assistants ne suppriment **rien**. Si vous avez créé la VM pour l'exercice,
supprimez uniquement ce que vous avez créé, vous-même, après avoir listé le
contenu du groupe : vérifiez le nom du groupe, listez ses ressources, supprimez
ce groupe dédié et lui seul. Ne supprimez jamais un groupe que vous n'avez pas
créé pour ce laboratoire.
