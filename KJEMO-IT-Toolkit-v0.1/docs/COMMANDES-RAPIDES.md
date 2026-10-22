# Commandes rapides

Une commande rapide est l'autre visage d'une notion : la ligne à taper pour qui
sait déjà ce qu'il veut, là où l'assistant guidé accompagne une opération à
plusieurs étapes. Le LOT 7 en livre **112**, rangées par notion (stockage,
permissions, services, réseau, SSH, Cockpit, Samba, Samba AD, NFS).

Répartition par risque : 101 en lecture, 8 réversibles, 3 « attention ».
Le détail est dans `LOT-7-MATRICE-COMMANDES-RAPIDES.json`.

## Les neuf obligations (`test/commandes-rapides.test.mjs`)

Chaque commande publie : un besoin, la commande, un exemple, la liste de ses
paramètres, l'explication de **chaque** option, un résultat attendu, une
vérification, un niveau de risque et un retour en arrière (ou l'écriture noir
sur blanc de son absence). La règle qui commande les autres : **aucun
commentaire dans le bloc copiable**. Un `#` collé dans un terminal ne se
comporte pas toujours en commentaire, et une commande copiée sur une seule
ligne perd tout ce qui suit.

Niveaux de risque : lecture, réversible, attention. Ils sont volontairement
distincts des quatre niveaux des fiches : une commande nue n'a ni sauvegarde, ni
validation, ni confirmation.

## Limite connue

Les commandes rapides sont des données enumérables et un contrat testé, mais
**aucun écran de l'application ne les affiche encore** : le banc navigateur le
constate et ne prétend pas les avoir éprouvées à l'écran. Elles n'ont pas été
exécutées sur un Ubuntu Server réel.
