# Laboratoire Imprimantes 2 — Configurer une imprimante réseau ou une file partagée, avec vérification

> **Statut : guide NON EXÉCUTÉ.** Aucune imprimante, aucun serveur d'impression et aucun poste Windows n'ont été utilisés.
> Les scripts ont été joués uniquement contre des doublures PowerShell 7. Windows PowerShell 5.1 : non exécuté.

## Objectif
Créer **un** port TCP/IP et **une** imprimante avec un pilote **déjà installé**, ou se connecter à **une** file partagée, puis vérifier
l'état relu. Chaque action est précédée d'une lecture et exige la phrase exacte affichée par la fiche.

## Matériel et machines
- Un poste Windows de laboratoire (jamais un poste de production) ; un compte administrateur pour la configuration réseau.
- Un pilote déjà présent (par exemple « Microsoft IPP Class Driver ») : **les assistants ne téléchargent ni n'installent aucun pilote**.
- **Sans imprimante physique** : l'étape de création du port et de l'imprimante peut être jouée avec une adresse de laboratoire ;
  la file sera créée, mais rien ne s'imprimera. Pour une file partagée il faut un second poste/serveur qui la partage.
- **Avec imprimante** : l'étape finale (page de test) consomme une page de papier et de l'encre ou du toner.

## Parcours
1. `imp-win-config-reseau` en mode **Diagnostic** — lecture des objets existants. *Attendu :* le script dit si le port ou l'imprimante existent déjà et ne change rien.
2. Même fiche en mode **Appliquer**, phrase exacte (ex. `CREER HP LaserJet Accueil SUR 192.168.30.50:9100`). *Attendu :* création du port puis de l'imprimante,
   relecture, conclusion mesurée. Si un objet du même nom existe, le script **refuse** (aucun remplacement silencieux) ; un pilote absent est signalé, pas installé.
3. `imp-win-connexion-partage` (Diagnostic puis Appliquer, phrase `CONNECTER \\serveur\partage`). *Attendu :* connexion de l'utilisateur courant
   à la file ; propre au compte, console non élevée.
4. `imp-win-defaut` (phrase `DEFINIR <nom> PAR DEFAUT`) — imprimante par défaut **du compte courant**. *Attendu :* relecture de la valeur ;
   Windows peut la changer ensuite si « Laisser Windows gérer l'imprimante par défaut » est actif.
5. `imp-win-page-test` (phrase `IMPRIMER UNE PAGE DE TEST SUR <nom>`) — action explicite annonçant papier et encre. *Attendu :* Windows accepte la demande (code 0) ;
   **seul le bac de sortie prouve** que la page est sortie.

## Retour arrière (à noter avant d'agir)
- Imprimante / port créés : suppression manuelle (le Toolkit ne supprime pas d'imprimante).
- Connexion de file partagée : suppression de la connexion par l'utilisateur.
- Imprimante par défaut : noter l'ancienne valeur affichée avant l'action.
- Page de test : **irréversible** (papier consommé).

## Limites
Aucune simulation native fiable pour `Add-Printer` (donc aucun `-WhatIf` n'est annoncé pour lui) ; `Add-PrinterPort` supporte `-WhatIf`.
Le lien avec une imprimante réelle (pilote adapté, firmware, bac) n'est pas éprouvé.

## Compte rendu à remplir (par vous, après essai)
| Étape | Résultat observé | Écart avec l'attendu |
|---|---|---|
| … | *à remplir* | *à remplir* |
