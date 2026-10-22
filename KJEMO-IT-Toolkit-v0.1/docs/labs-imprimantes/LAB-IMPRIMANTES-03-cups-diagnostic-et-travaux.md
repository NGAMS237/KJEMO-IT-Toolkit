# Laboratoire Imprimantes 3 — Linux / CUPS : diagnostic et gestion ciblée d'un travail

> **Statut : guide NON EXÉCUTÉ.** Aucun cupsd réel ni aucune imprimante n'ont été utilisés ; les scripts Bash ont été exécutés
> uniquement contre de **faux binaires CUPS** (banc `test/impression-assistants.test.mjs`). ShellCheck et `bash -n` sont des analyses, pas des exécutions réelles.

## Objectif
Lire l'état de CUPS, d'une destination et de ses travaux, puis agir sur **un seul** travail ou **une seule** file, avec relecture.

## Matériel et machines
- Une VM Ubuntu 22.04/24.04 ou Debian 12 avec `cups` et `cups-client`.
- **Sans imprimante physique** : créer à la main (hors Toolkit) une file de test, par exemple une file « PDF » ou une file vers une adresse inexistante,
  pour obtenir une file désactivée et des travaux en attente. Les assistants ne créent aucune file (`lpadmin` n'est jamais appelé).
- **Avec imprimante** : son URI (ipp, socket, lpd, usb) pour que le diagnostic réseau ait une cible.

## Parcours
1. `imp-cups-inventaire` — destinations, URI (secrets masqués), file par défaut, genre de périphérique (heuristique, dite comme telle). *Attendu :* liste des destinations ; filtre optionnel par nom exact.
2. `imp-cups-diagnostic-file` — nom exact de la destination. *Attendu :* service CUPS, état, acceptation, raison d'arrêt déclarée, travaux, DNS puis TCP sur le port de l'URI,
   journal (inaccessible signalé comme tel). Rappel : un port ouvert ne prouve pas qu'une page sortira.
3. `imp-cups-annuler-travail` — destination + numéro de travail (+ propriétaire attendu facultatif). Diagnostic d'abord ; phrase `ANNULER LE TRAVAIL <dest>-<n>`.
   *Attendu :* un seul `cancel` avec l'identifiant exact, relecture par `lpstat -o` ; jamais `cancel -a`, jamais de purge de `/var/spool/cups`.
4. `imp-cups-reactiver-file` — `cupsenable` (Réactiver) ou `cupsaccept` (Accepter). Phrase `REACTIVER <dest>` / `ACCEPTER LES TRAVAUX DE <dest>`.
   *Attendu :* raison d'arrêt montrée **avant** d'agir ; relecture ; le rapport rappelle que réactiver ne corrige pas la cause.

## Ce que ces assistants ne font jamais
Redémarrer cupsd, modifier `cupsd.conf`, ouvrir l'administration CUPS au réseau, changer les règles d'accès, créer/supprimer une file, installer un pilote.

## Retour arrière
Réactiver une file : `cupsdisable` à la main si besoin. Annuler un travail : **irréversible**.

## Compte rendu à remplir (par vous, après essai)
| Étape | Résultat observé | Écart avec l'attendu |
|---|---|---|
| … | *à remplir* | *à remplir* |
