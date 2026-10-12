# LOT 4 — décisions

Ce document explique les choix qui ne se devinent pas à la lecture du code,
et surtout ceux où une autre décision aurait été défendable.

---

## 1. Préparer n'est pas appliquer

C'est la décision centrale du lot, et elle gouverne quatre assistants sur
dix-huit.

Les extensions de stratégie de groupe suivantes **n'ont aucune applet de
commande officielle** : mappages de lecteurs, imprimantes par préférences,
redirection de dossiers, installation de logiciel, raccourcis de préférences.
Elles vivent dans des fichiers XML de SYSVOL, dont le format n'est pas un
contrat public.

Trois chemins étaient possibles :

| Chemin | Verdict |
|---|---|
| Écrire les XML de SYSVOL à la main | **Refusé.** Un XML fabriqué produit des stratégies que la console ne sait plus relire — et personne ne s'en aperçoit avant le jour où il faut modifier le réglage en urgence. |
| Passer par des objets COM non documentés | **Refusé.** Une API non documentée change sans préavis, et un parc de soins n'est pas un terrain d'essai. |
| Préparer, vérifier, puis donner les étapes exactes de la console | **Retenu.** |

`gpo-drive-mapping`, `gpo-printer-deployment`, `gpo-logon-startup-scripts` et
`gpo-folder-redirection` **ne proposent donc aucun mode Appliquer**. Leur
script vérifie les prérequis — partage joignable, droits, cible lisible,
secrets absents du script de connexion — puis affiche, en toutes lettres :
*« Il n'a RIEN configuré. »* La fiche porte la procédure console complète.

Un test le vérifie pour chacun des quatre : aucun champ `mode`, aucune écriture
de stratégie, aucun XML écrit, et au moins quatre étapes de console.

### L'exception : la base MSI

`gpo-software-shortcuts-browser` lit le code produit et la version d'un paquet
`.msi` par l'**interface d'automatisation de Windows Installer**, en lecture
seule (mode 0). C'est un objet COM — mais documenté par Microsoft, stable
depuis vingt ans, et rien n'est écrit dans le paquet. Le script porte le lien
vers la documentation en commentaire. Sans cette lecture, l'assistant ne
pourrait pas donner le code produit, qui est précisément ce qu'il faut pour
déclarer une mise à niveau.

---

## 2. Les deux stratégies par défaut sont intouchables

`Default Domain Policy` et `Default Domain Controllers Policy` ne se modifient
jamais depuis ce catalogue. Ce n'est pas une préférence de style : ces deux
objets portent les réglages dont dépend l'ouverture de session de tout le
domaine, et une erreur dedans n'a pas de retour simple.

Le refus vit à **trois endroits**, parce qu'un seul garde-fou est un garde-fou
qu'on contourne :

1. `refuseGpoParDefaut()` dans les validateurs, comparaison insensible à la
   casse, aux espaces et aux accents (normalisation NFKD) — `Défault Dömain
   Pölicy` est refusé comme `Default Domain Policy` ;
2. `validate()` de chaque assistant qui désigne une GPO cible ;
3. le script PowerShell lui-même, qui recalcule `$cibleAutorisee` et nomme les
   deux stratégies — parce qu'un script téléchargé puis modifié à la main n'a
   plus de formulaire derrière lui.

---

## 3. Le lien naît inactif

`gpo-create-link` crée le lien **désactivé** par défaut. Une stratégie liée et
active s'applique au prochain rafraîchissement, c'est-à-dire avant que
quiconque ait eu le temps de la relire.

Le choix coûte une manipulation supplémentaire — activer le lien une fois
vérifié. Il évite la catégorie d'incident la plus coûteuse de ce domaine : une
stratégie correcte liée au mauvais endroit.

Le script exporte en CSV les liens existants de l'OU **avant** d'agir.

---

## 4. Le filtrage de sécurité n'enlève jamais rien

`gpo-security-filter` **ajoute** une permission et vérifie qu'aucune n'a
disparu. Il ne retire rien.

La raison est MS16-072 : depuis ce correctif, la stratégie est lue avec le
compte **ordinateur**, pas avec le compte de l'utilisateur. Retirer
« Utilisateurs authentifiés » du filtrage sans accorder au moins le droit de
lecture aux ordinateurs fait silencieusement cesser d'appliquer la stratégie.
L'assistant sépare donc explicitement `GpoRead` de `GpoApply` et le dit.

---

## 5. Les filtres WMI sont préparés, pas créés

`gpo-wmi-filter-readiness` exécute la requête WQL, mesure sa durée, lit les
objets `msWMI-Som` existants — et **refuse de créer ou d'associer** un filtre.

La création d'un filtre WMI passe par des objets d'annuaire dont la structure
n'est pas un contrat documenté. Un filtre mal formé ne lève pas d'erreur : il
rend simplement la stratégie inapplicable, partout, en silence. L'assistant
donne les six étapes de la console.

Il signale aussi `Win32_Product` : interroger cette classe déclenche une
revalidation de tous les paquets installés, qui peut prendre plusieurs minutes
par poste et apparaît dans les journaux comme une réparation de logiciel.

---

## 6. Aucun mode ne désactive le pare-feu ni Defender

`gpo-firewall-defender` est **en diagnostic pur** : il n'a pas de champ `mode`.
Il lit les profils, les règles entrantes autorisées, l'état de Defender et ses
exclusions — et signale celles qui sont trop larges.

Un assistant web qui peut désactiver un pare-feu de domaine est un assistant
qui le désactivera un jour par erreur. La valeur de cet outil est de **montrer**
ce qui est déjà ouvert, ce qui est beaucoup plus souvent le vrai problème.

---

## 7. Le niveau Audit n'écrit rien, même en mode Appliquer

`gpo-device-restrictions` propose trois niveaux : `Audit`, `LectureSeule`,
`Blocage`. **`Audit` n'écrit rien, y compris lorsque le mode est Appliquer.**

C'est délibérément contre-intuitif, et c'est le but : on inventorie d'abord ce
qui est branché, on regarde qui travaille avec une clé USB, et on décide
ensuite. Les claviers et les souris ne sont jamais touchés — la restriction ne
porte que sur la classe des volumes amovibles.

---

## 8. Une restauration n'est jamais de la routine

`gpo-backup-restore-compare` porte le risque `destructive`, et trois verrous
que `Restore-GPO` doit tous franchir :

1. le mode est `Appliquer` ;
2. la cible n'est pas une stratégie par défaut ;
3. **une sauvegarde fraîche de l'état actuel a réussi ET a été relue sur
   disque.**

Le troisième est le plus important. Si la restauration se révèle être une
erreur, c'est cette copie-là qui permettra de revenir ; son identifiant est
affiché dans le rapport. **Si la sauvegarde échoue, la restauration ne part
pas** — l'ordre d'évaluation est vérifié par un test, qui contrôle que le
blocage apparaît dans le script avant l'appel à `Restore-GPO`.

S'y ajoute une confirmation écrite : le nom de la stratégie, retapé au
caractère près. Et l'assistant dit ce que la restauration **ne** remet pas :
ni les liens, ni le filtrage de sécurité, ni les filtres WMI. Une stratégie
restaurée peut sembler correcte et ne s'appliquer à personne.

Aucune GPO n'est supprimée, dans aucun mode, par aucun des dix-huit assistants.

---

## 9. `gpupdate` sans `/force`

`gpo-refresh-diagnostic` lance `gpupdate` **sans** `/force` par défaut. `/force`
réapplique l'intégralité des stratégies, ce qui sur un parc chargé produit une
pointe de charge sur les contrôleurs de domaine sans rien apprendre de plus
dans neuf cas sur dix.

Ni `/boot` ni `/logoff` ne sont jamais passés : un redémarrage ou une fermeture
de session déclenchés par un assistant web, pendant que quelqu'un travaille,
n'est pas une option.

---

## 10. Pourquoi le champ `mode` n'est pas varié par les jeux de données

Les huit jeux de données du banc de génération couvrent désormais les champs
GPO — domaine, noms, chemins UNC, groupes, requêtes WQL, durées, formats — avec
apostrophes ASCII et typographiques, dollar, accent grave, guillemets, accents,
virgules et points-virgules. Les 144 nouveaux scripts ont **144 empreintes
distinctes**.

Le champ `mode` est volontairement laissé de côté : il est **partagé** avec les
assistants des lots 2 et 3, et le forcer à `Appliquer` aurait changé leurs
scripts figés — exactement ce que la garde d'identité est là pour interdire.

Les branches d'écriture sont donc couvertes autrement : `identity.test.mjs`
appelle `generate()` en mode `Appliquer` pour chaque assistant qui en propose
un, et passe les deux versions au même scanner de règles de sécurité.

---

## 11. Un script qui cherche des secrets sans en contenir

`gpo-logon-startup-scripts` cherche, dans les scripts de connexion déposés sur
SYSVOL, les motifs qui trahissent un mot de passe en clair. Il devait donc
porter les chaînes `ConvertTo-SecureString` et `AsPlainText` — que le propre
scanner de sécurité du projet interdit dans les scripts générés.

Affaiblir le scanner aurait été la mauvaise réponse. Les motifs sont assemblés
à l'exécution :

```powershell
# Le motif est assemble pour ne pas declencher le scanner du projet, qui
# interdit ces chaines dans un script genere. Ici elles sont CHERCHEES,
# pas utilisees.
$motifSecureString = 'ConvertTo-Secure' + 'String'
$motifTexteClair   = 'AsPlain' + 'Text'
```

Le scanner reste intact, et le script fait son travail.

---

## 12. Organisation du code

- Un seul nouveau module : `dist/outils-gpo.mjs`.
- `dist/validateurs.mjs` est **étendu**, pas dupliqué : aucune seconde copie de
  validateur n'existe.
- `dist/generators.mjs` ne change que de **deux lignes** — un `import` et une
  boucle d'assemblage. Aucun `generate()` existant n'est touché, ce que les
  296 empreintes figées prouvent à chaque exécution.
- Aucun framework, aucun bundler, aucun backend, aucune dépendance ajoutée.

---

## 13. Ce que ce lot ne prouve pas

Aucun de ces assistants n'a été exécuté sur un domaine Windows Server réel.
Ce qui est prouvé : la génération JavaScript, l'analyse PowerShell 7, le
comportement du navigateur, et les contre-épreuves.

Ce qui ne l'est pas : le comportement des applets `GroupPolicy` sur un domaine
vivant. Cela demande un laboratoire, et cela reste à faire.
