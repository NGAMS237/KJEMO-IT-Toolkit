> **LA V2 REMPLACE `LOT-5-RESEAU-AVANCE.patch`. NE PAS APPLIQUER LES DEUX.**
> Ce document remplace `LOT-5-DECISIONS.md`.

# LOT 5 — décisions v2

Les choix qui ne se devinent pas à la lecture du code, et surtout ceux où une
autre décision aurait été défendable.

Les sections **14 à 17** sont nouvelles : elles portent les décisions prises en
réponse à la revue.

---

## 1. Pourquoi BigInt, et pas `>>> 0`

Les opérateurs `&`, `|`, `~` et `<<` de JavaScript convertissent leurs
opérandes en entiers 32 bits **signés**. Dès que le premier octet d'une IPv4
dépasse 127, le résultat devient négatif :

```js
192 << 24          // -1073741824
~0xFFFFFF00        // 255, et non 4294967040
```

La parade connue est de semer des `>>> 0` partout. Elle fonctionne — tant
qu'on n'en oublie aucun. Et l'oubli ne se voit pas : il produit un masque
**faux pour 10.0.0.0/8 et juste pour 192.168.1.0/24**. C'est exactement
l'erreur qui passe tous les essais faits à la main, parce qu'on essaie
d'abord avec l'adresse qu'on a sous les yeux, et qu'elle est presque toujours
en 192.168.

`dist/calcul-ip.mjs` travaille donc en BigInt de bout en bout. Il n'y a ni
signe, ni débordement, ni `>>> 0` à ne pas oublier.

Le même raisonnement vaut ailleurs : `estPlagePrivee` compare par **bornes
entières** plutôt que par masque binaire, et `route-table-diagnostic` calcule
l'appartenance à un préfixe par divisions entières. Côté PowerShell, le calcul
se fait en `[int64]` par divisions et modulos, parce que `[int]4294967295`
déborde.

Un test le vérifie dans les deux sens : il reproduit la faute avec les
opérateurs signés et **exige que le résultat diffère**.

---

## 2. Le /31, et pourquoi c'est le cas qui compte

Un calculateur qui retire systématiquement deux adresses — réseau et
diffusion — annonce **0 adresse utilisable pour un /31**. C'est faux depuis la
RFC 3021 : sur une liaison point à point, les deux adresses sont utilisables.

Le /32 a sa propre exception : une seule adresse, utilisable.

La contre-épreuve introduit délibérément cette erreur et vérifie qu'elle est
détectée. Elle vérifie aussi, en contrôle positif, que **la même erreur est
invisible en /24** — ce qui est précisément pourquoi le /31 doit figurer dans
la liste des essais.

---

## 3. Le calculateur calcule dans le navigateur

Les vingt et un autres assistants produisent un script qu'on va exécuter.
Celui-ci produit une **réponse**, et l'attendre d'une exécution serait absurde.

Le calcul est fait en JavaScript, par `dist/calcul-ip.mjs`, au moment où le
formulaire change, et le résultat est gravé en tête du script généré.

Le script PowerShell téléchargeable refait le **même calcul, de façon
indépendante**. Il sert à deux choses : calculer sur une machine sans accès au
site, et permettre aux deux implémentations de se contrôler l'une l'autre.

---

## 4. Les garde-fous de découverte, et pourquoi trois messages distincts

Toute découverte réseau est limitée au sous-réseau **privé**, à **/24** au plus
large, et à **254 hôtes**. Les trois refus portent chacun leur propre message,
parce qu'ils n'ont pas la même cause et n'appellent pas la même correction :

| Refus | Message |
|---|---|
| Plage publique | « examiner une plage publique sans y être autorisé est une intrusion, pas un diagnostic » |
| Trop large | nomme le nombre d'hôtes visés et le plafond |
| Pas une adresse de réseau | propose l'adresse corrigée |

Un message unique du genre « plage invalide » aurait été plus court, et aurait
laissé chercher.

Les listes de ports sont plafonnées à **vingt, nommés un à un**. Les
intervalles sont refusés.

---

## 5. Ce qui n'est pas automatisé, et pourquoi

| Opération | Décision |
|---|---|
| `ipconfig /release` puis `/renew` | **Jamais.** La libération coupe le réseau ; sur une session distante, la commande suivante n'arrive jamais. |
| Vider toute la table ARP | **Jamais.** La machine perd d'un coup la résolution de niveau 2 vers tous ses voisins, passerelle comprise. Le renouvellement est ciblé, et l'adresse est exigée. |
| Désactiver une carte réseau | **Jamais.** Une carte se rallume devant la machine. |
| Réactiver un profil de pare-feu désactivé | **Jamais.** C'est une décision qui se prend, pas un réglage qu'on corrige au passage. |
| Supprimer la route par défaut | **Jamais de lui-même.** La poser exige une confirmation écrite distincte. |
| Restreindre la plage RPC | **Jamais.** Une plage trop étroite épuise les ports sous charge. |

---

## 6. Quatre assistants modifient — correction de la v1

La v1 annonçait « trois assistants seulement écrivent ». C'était faux, et la
revue l'a relevé. Il y en a **quatre**, et la confusion venait d'une distinction
qui n'était pas faite.

### Modifier une configuration, ou écrire un rapport

Ce ne sont pas les mêmes enjeux. Un assistant qui dépose un fichier sur le
Bureau ne met personne en danger. Un assistant qui change les serveurs DNS
d'une carte peut faire perdre une machine distante.

**Modifient une configuration — quatre :**

| Assistant | Ce qu'il change | Filet |
|---|---|---|
| `dns-cache-reset` | vide le cache DNS | affichage obligatoire avant ; le cache se remplit seul |
| `dns-client-change` | les serveurs DNS d'une carte | annulation **écrite avant** ; quatre conditions avant d'écrire (§14) |
| `route-manager` | une route statique | table sauvegardée en CSV ; aperçu `-WhatIf` ; cinq conditions avant de poser (§15) |
| `arp-neighbor-diagnostic` | **une entrée de voisinage** (`Remove-NetNeighbor`) | l'adresse est exigée ; jamais la table entière ; réversible par nature — elle se reconstruit au prochain échange |

`arp-neighbor-diagnostic` était classé `caution` dès la v1, et sa fiche disait
ce qu'il fait. Ce qui manquait, c'est qu'il figure dans le décompte.

**Écrit des fichiers, sans rien changer — un cas nommément :**

`network-baseline` produit des **fichiers de capture** (`New-Item`,
`Set-Content`, `Export-Csv`, JSON) pour pouvoir comparer un avant et un après.
C'est une écriture de rapport. Elle ne touche aucun réglage.

Tout assistant dont le format de rapport n'est pas `Console` écrit lui aussi un
fichier. C'est la même catégorie, et elle n'a jamais été le sujet.

### La commande d'annulation est écrite AVANT

`dns-client-change` et `route-manager` ne produisent pas un modèle à compléter :
ils relèvent l'état réel, et composent la commande exacte qui le rétablirait —
avant d'agir. Pour les DNS, elle diffère selon que la carte était en DHCP ou
fixée à la main. Pour la route, elle vise destination, passerelle **et**
interface, jamais un préfixe seul qui emporterait tout ce qui lui ressemble.

Depuis la v2, **l'échec de cette construction bloque l'écriture** : une
annulation inventée est pire que pas d'annulation du tout, parce qu'elle donne
confiance sans rien garantir.

---

## 7. Aucun secret, et la ligne qui le prouve

`netsh wlan show profile name="X" key=clear` existe, et affiche la clé du
réseau en clair. Cet assistant ne l'appelle **jamais**, et le script dit
pourquoi : un rapport de diagnostic circule par courriel, s'attache à un
billet, et reste des années dans un dossier partagé.

De même : aucun mot de passe demandé, aucun montage avec identifiants, aucun
secret VPN, aucune validation TLS désactivée.

`http-https-tls-test` ne propose aucune option pour ignorer la validation TLS.
C'est tentant — un `-SkipCertificateCheck` fait disparaître l'erreur. Il fait
surtout disparaître le **diagnostic** : on ne sait plus si le certificat était
expiré, mal nommé, ou signé par une autorité inconnue. Le certificat est donc
lu **séparément** de la requête.

---

## 8. Les interdits se jugent sur le code, pas sur les commentaires

Plusieurs scripts expliquent en toutes lettres qu'ils n'appellent jamais
`key=clear`, qu'ils ne lancent pas `ping -t`. Une première version des
contrôles les a fait échouer sur ces explications.

Les contrôles filtrent donc les lignes de commentaire et les `Write-Host` avant
de chercher un motif interdit.

Une exception : **l'apostrophe typographique reste interdite partout**,
commentaires compris. Windows PowerShell 5.1 lit un fichier sans BOM en CP1252,
et un commentaire suffit à casser l'analyse.

---

## 9. L'interdit sur `Invoke-WebRequest`, affiné plutôt que levé

Le LOT 2 interdit `Invoke-WebRequest` dans tout script généré. L'interdit vise
le fait de **rapporter du code et de l'exécuter**.

`http-https-tls-test` doit émettre une requête : sans elle, il ne teste rien.
L'exception est donc **nominative**, portée par identifiant, avec sa
justification écrite dans le code du test.

Elle s'accompagne de quatre contrôles nouveaux qui valent pour **tous** les
scripts : pas de `DownloadString`, pas de `-OutFile`, pas de requête dirigée
vers une exécution, pas de `Start-BitsTransfer`.

---

## 10. Client, pas serveur

DHCP et DNS apparaissent dans ce lot, et c'est voulu — mais côté **client**.
Les deux assistants concernés le disent dès la première ligne de leur rapport.
« Problème DHCP » recouvre deux choses très différentes : un poste qui n'obtient
pas de bail, et un service qui n'en distribue plus.

---

## 11. Deux défauts trouvés pendant la construction

**`smbFormat` était déjà pris.** `smb-sessions-diagnostic`, du LOT 2, porte un
champ de ce nom. Le champ du LOT 5 est renommé `smbcFormat`. Renommer le
nouveau plutôt que de toucher l'ancien est la seule option : la garde
d'identité existe pour interdire la seconde.

**`validerCibleReseau` acceptait « 256.1.1.1 ».** Quatre groupes de chiffres
séparés par des points sont désormais jugés comme une tentative d'adresse IPv4,
et refusés comme telle.

---

## 12. La sous-rubrique « Adressage IP »

La catégorie Réseau compte **23** assistants : les 22 de ce lot, plus
`static-ip`, qui existe depuis le LOT 1. Il n'a pas été déplacé : changer sa
sous-rubrique changerait ses scripts générés.

---

## 13. Ce que ce lot ne prouve pas

Aucun de ces vingt-deux assistants n'a été exécuté sur une vraie machine
Windows, sur un vrai réseau, ni contre un vrai domaine.

Ce qui est prouvé : la génération, l'analyse syntaxique PowerShell 7, le
comportement du navigateur, la justesse du calculateur, les contre-épreuves, et
— depuis la v2 — la **logique de blocage** des deux assistants qui écrivent.

Ce qui ne l'est pas : le comportement de `Test-NetConnection`, `Get-NetRoute`,
`Get-NetNeighbor`, `Resolve-DnsName` ou `netsh wlan` sur un parc vivant.

---

## 14. Pourquoi un nom DNS à saisir, et pas un nom choisi par le script

**Décision** : `dns-client-change` exige un nom DNS d'épreuve, saisi, avec
`www.microsoft.com` par défaut.

Trois autres options existaient.

**Interroger `$env:COMPUTERNAME`**, ce que faisait la v1. Mauvais : le nom de la
machine n'est pas forcément résolvable par les serveurs visés, et un échec
légitime passerait pour une panne. Pire — avec `-DnsOnly` absent, la réponse
pouvait venir de LLMNR et non du serveur interrogé.

**Choisir un nom public en dur, sans champ.** Un serveur DNS d'annuaire
parfaitement sain peut n'avoir aucune résolution vers l'extérieur : le script
refuserait d'écrire pour une bonne raison en apparence et une mauvaise en fait.

**Rendre le champ facultatif.** Alors il serait vide dans la moitié des cas, et
le verrou se désarmerait tout seul. Un garde-fou qu'on peut omettre n'en est
pas un.

Le champ est donc **obligatoire**, et son texte d'aide dit explicitement de
remplacer la valeur par défaut par un nom interne quand les serveurs visés sont
des serveurs d'annuaire. La valeur publique n'est pas une recommandation : c'est
un point de départ qui marche hors domaine.

**Une adresse y est refusée.** Interroger un serveur DNS avec une adresse
déclenche une résolution inverse, qui échoue sur la plupart des serveurs sains.
Ce ne serait pas une épreuve, ce serait un faux négatif systématique.

### Pourquoi six issues et pas deux

« Répond / ne répond pas » aurait suffi au verrou. Mais la personne devant
l'écran doit savoir quoi corriger, et ce n'est pas la même chose :

- un **délai dépassé** envoie regarder le pare-feu ou l'état du service ;
- un **refus** envoie regarder la liste des clients autorisés et la récursion ;
- une **réponse négative** envoie regarder le nom d'épreuve, ou la zone ;
- un **silence** n'oriente vers rien, et le script le dit plutôt que de
  prétendre.

Le verrou, lui, ne retient qu'une chose : une réponse avec adresse, ou rien.

### Pourquoi TCP 53 reste affiché

On aurait pu le retirer : il a induit le défaut. Mais c'est une information
utile au dépannage — elle sépare « le chemin réseau est coupé » de « le chemin
passe, le service refuse ». Elle est donc **conservée et étiquetée** :
« indication seule, non probante ». Et le banc d'essai la rend **toujours
positive**, précisément pour que la contre-épreuve échoue si elle redevenait
décisive.

---

## 15. Pourquoi l'écho ICMP sort des conditions de `route-manager`

**Décision** : le ping n'est plus une condition, et n'est même plus classé
`ATTENTION`. Il passe en `INFO`.

Une passerelle qui refuse ICMP route parfaitement — c'est même une
configuration courante sur un routeur de bordure. En faire un préalable
interdirait des poses légitimes, et les gens contourneraient le garde-fou, ce
qui est pire que de ne pas en avoir.

Et l'inverse est vrai aussi : une passerelle qui répond à l'écho peut très bien
ne rien router. Le ping ne prouve ni dans un sens ni dans l'autre.

Ce qui décide, c'est l'**appartenance de la passerelle à un préfixe directement
connecté à la carte**. C'est une propriété vérifiable localement, sans dépendre
du bon vouloir d'un équipement distant.

### Pourquoi une fonction PowerShell nommée, et pas du code en ligne

L'ancien calcul était une boucle d'octets suivie d'un masque partiel, posée au
milieu de la section 2. Il était juste, pour autant qu'on puisse en juger à la
lecture — mais justement : on ne pouvait que le lire.

Extrait dans `Test-KjemoMemePrefixe`, il devient **interrogeable**. Le banc
dot-source le script, ce qui laisse la fonction dans sa portée, et lui pose
vingt questions dont il connaît les réponses : /9, /17, /23, /25, /30, /31, /32,
plus /1 et /4 pour le bit de signe, plus deux /24 comme contrôle négatif.

Le /24 est là pour une raison précise : il réussit **même quand le calcul est
faux**. Une liste d'essais qui ne contiendrait que des /24 ne prouverait rien,
et c'est exactement comme cela qu'un défaut d'arithmétique survit à une
relecture.

### Pourquoi `[int64]` et des divisions, plutôt qu'un masque

Même raison qu'au §1, côté PowerShell cette fois. `-band`, `-shl` et `[int]`
sont signés : un masque construit par décalage devient négatif dès que le
premier octet dépasse 127. Le calcul se fait donc par `[Math]::Floor($v /
$taille)` sur des `[int64]`. Aucun décalage, aucun `-band`, rien à ne pas
oublier.

### Pourquoi l'aperçu `-WhatIf` reste, même quand la pose est bloquée

`-WhatIf` n'écrit rien : il demande à PowerShell lui-même de décrire l'action.
Le voir reste utile quand la pose est refusée — il montre ce qui aurait été
tenté. Le banc le consigne donc **sous un autre nom** que la pose réelle, pour
que le comptage ne confonde pas les deux.

---

## 16. Pourquoi un paramètre de version facultatif, plutôt que de changer la constante

**Décision** : `VERSION_OUTILS` reste `LOT 2 — 2.0.0`, et seuls les 22 outils du
LOT 5 passent leur propre version.

Changer la constante aurait été une ligne. Elle aurait aussi réécrit les 440
scripts figés, c'est-à-dire cassé la garde d'identité — la seule chose qui
permette d'affirmer qu'un correctif n'a pas touché à ce qu'il ne devait pas
toucher. Et la revue demandait explicitement de ne pas modifier ces 440.

Le paramètre est donc **facultatif**, et `assembler` ne le transmet que s'il est
fourni. Omis, l'en-tête produit est l'ancien, caractère pour caractère. C'est
ce qui a permis de vérifier 440/440 identiques après la modification.

Une **contre-épreuve** vérifie que le paramètre a réellement un effet : sans
lui, l'en-tête porte la version par défaut ; avec lui, il porte la version
demandée et pas l'autre. Un gabarit qui ignorerait silencieusement le paramètre
ferait passer toutes les autres assertions.

### La dette, nommée plutôt que corrigée au passage

376 scripts antérieurs portent encore `LOT 2 — 2.0.0`, dont 120 du LOT 3 et 144
du LOT 4. 64 scripts du LOT 1 ne passent pas par le gabarit commun et n'ont
aucune ligne de version.

Les corriger ici aurait été cohérent et aurait été une faute : un correctif qui
touche 440 fichiers hors de son sujet n'est plus relisible. `test/generate-ps1.mjs`
compte et affiche cette dette à **chaque exécution**, pour qu'elle ne se perde
pas, et elle attend une migration globale explicitement autorisée.

---

## 17. Pourquoi des mouchards, et pourquoi la contre-épreuve n'est pas facultative

**Décision** : les deux défauts sont prouvés par des tests qui **exécutent**
réellement les scripts, cmdlets d'écriture remplacées par des fonctions qui
consignent leurs appels.

Une recherche textuelle aurait suffi à vérifier que la bonne condition figure
dans le script. Elle n'aurait pas vérifié qu'elle **s'applique** — et c'est
exactement le défaut signalé : la vérification était présente, écrite, visible,
et sans effet. Un contrôle qui lit le texte aurait validé la version fautive.

Trois choix dans la construction de ces bancs méritent d'être dits.

**Le contrôle positif n'est pas décoratif.** Un journal d'appels vide peut
vouloir dire « le script s'est abstenu », ou « les mouchards ne se déclenchent
jamais », ou « le script est mort avant d'arriver là ». La passe où tout
réussit, et où l'on exige **exactement un** appel, écarte les deux dernières
lectures. Et un marqueur de fin de rapport est exigé dans chaque passe : sans
lui, un script qui ne démarre pas « réussirait » pour la mauvaise raison.

**La contre-épreuve n'est pas facultative.** Chaque banc retire le verrou dans
une copie du script et exige que le test **voie** l'appel interdit. Un test
incapable d'échouer ne prouve rien, et c'est vérifiable à peu de frais.

**Le leurre est délibéré.** Les deux bancs rendent toujours positif le signal
qui avait induit le défaut : TCP 53 pour les DNS, l'écho ICMP pour la route. Si
l'un des deux redevenait décisif, la première passe écrirait, et le test
tomberait.

Les deux bancs tournent sous les **deux moteurs** en CI, interpréteur imposé,
sans `continue-on-error`. Si l'interpréteur demandé est absent, le test échoue
— il ne se rabat jamais sur l'autre : un résultat obtenu sous PowerShell 7 ne
peut pas être présenté comme un résultat Windows PowerShell 5.1.
