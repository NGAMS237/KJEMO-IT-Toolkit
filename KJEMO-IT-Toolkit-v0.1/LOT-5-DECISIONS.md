# LOT 5 — décisions

Les choix qui ne se devinent pas à la lecture du code, et surtout ceux où une
autre décision aurait été défendable.

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
signe, ni débordement, ni `>>> 0` à ne pas oublier. La conversion vers
`Number` ne se fait qu'au tout dernier moment, sur des valeurs qui tiennent
largement dans un double.

Le même raisonnement vaut ailleurs : `estPlagePrivee` compare par **bornes
entières** plutôt que par masque binaire, et `route-table-diagnostic` calcule
l'appartenance à un préfixe par divisions entières. Côté PowerShell, le
calcul se fait en `[int64]` par divisions et modulos, parce que
`[int]4294967295` déborde.

Un test le vérifie dans les deux sens : il reproduit la faute avec les
opérateurs signés et **exige que le résultat diffère**. Si les deux
coïncidaient, la précaution serait sans objet.

---

## 2. Le /31, et pourquoi c'est le cas qui compte

Un calculateur qui retire systématiquement deux adresses — réseau et
diffusion — annonce **0 adresse utilisable pour un /31**. C'est faux depuis la
RFC 3021 : sur une liaison point à point, les deux adresses sont utilisables,
et il n'y a ni adresse de réseau ni adresse de diffusion à retrancher.

Le /32 a sa propre exception : une seule adresse, utilisable.

La contre-épreuve du LOT 5 introduit délibérément cette erreur et vérifie
qu'elle est détectée. Elle vérifie aussi, en contrôle positif, que **la même
erreur est invisible en /24** — ce qui est précisément pourquoi le /31 est le
cas qui doit figurer dans la liste des essais.

---

## 3. Le calculateur calcule dans le navigateur

Les vingt et un autres assistants produisent un script qu'on va exécuter.
Celui-ci produit une **réponse**, et l'attendre d'une exécution serait absurde.

Le calcul est donc fait en JavaScript, par `dist/calcul-ip.mjs`, au moment où
le formulaire change, et le résultat est gravé en tête du script généré — donc
visible dans l'aperçu, immédiatement.

Le script PowerShell téléchargeable refait le **même calcul, de façon
indépendante**, avec sa propre arithmétique. Il sert à deux choses : calculer
sur une machine sans accès au site, et permettre aux deux implémentations de se
contrôler l'une l'autre. Si elles divergent, l'une a tort et cela se voit.

Ce choix ne demande aucune modification de `app.js` : l'application continue à
générer, afficher, copier et télécharger, et rien d'autre. Elle ne prétend à
aucun moment exécuter quoi que ce soit depuis GitHub Pages.

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
intervalles sont refusés. C'est ce qui sépare un test d'administration d'un
balayage, et le validateur le dit plutôt que de tronquer en silence.

---

## 5. Ce qui n'est pas automatisé, et pourquoi

| Opération | Décision |
|---|---|
| `ipconfig /release` puis `/renew` | **Jamais.** La libération coupe le réseau ; sur une session distante, la commande suivante n'arrive jamais. L'assistant DHCP explique la manœuvre et laisse la faire devant la machine. |
| Vider toute la table ARP | **Jamais.** La machine perd d'un coup la résolution de niveau 2 vers tous ses voisins, passerelle comprise. Le renouvellement est ciblé, et l'adresse est exigée. |
| Désactiver une carte réseau | **Jamais.** Une carte se rallume devant la machine. |
| Réactiver un profil de pare-feu désactivé | **Jamais.** C'est une décision qui se prend, pas un réglage qu'on corrige au passage. L'état est rapporté. |
| Supprimer la route par défaut | **Jamais de lui-même.** La poser exige une confirmation écrite distincte, et le rollback porte un avertissement critique. |
| Restreindre la plage RPC | **Jamais.** Elle s'applique à tous les services RPC de la machine, et une plage trop étroite épuise les ports sous charge. |

---

## 6. Trois assistants seulement écrivent

Dix-neuf sur vingt-deux ne modifient rien. Les trois autres :

| Assistant | Ce qu'il écrit | Filet |
|---|---|---|
| `dns-cache-reset` | vide le cache DNS | affichage obligatoire avant ; le cache se remplit seul |
| `dns-client-change` | les serveurs DNS d'une carte | commande d'annulation **écrite avant**, avec les valeurs réelles ; serveurs éprouvés avant d'être imposés |
| `route-manager` | une route statique | table sauvegardée en CSV avant ; aperçu `-WhatIf` ; annulation visant la route **exacte** |

`arp-neighbor-diagnostic` retire une entrée de voisinage, ce qui est réversible
par nature : elle se reconstruit au prochain échange. Il est classé `caution`
quand même, parce qu'il touche l'état de la machine.

### La commande d'annulation est écrite AVANT

C'est le point qui mérite d'être souligné. `dns-client-change` et
`route-manager` n'écrivent pas un modèle à compléter : ils relèvent l'état
réel, et composent la commande exacte qui le rétablirait — avant d'agir. Pour
les DNS, elle diffère selon que la carte était en DHCP ou fixée à la main. Pour
la route, elle vise destination, passerelle **et** interface, jamais un préfixe
seul qui emporterait tout ce qui lui ressemble.

---

## 7. Aucun secret, et la ligne qui le prouve

`netsh wlan show profile name="X" key=clear` existe, et affiche la clé du
réseau en clair. Cet assistant ne l'appelle **jamais**, et le script dit
pourquoi : un rapport de diagnostic circule par courriel, s'attache à un
billet, et reste des années dans un dossier partagé.

De même : aucun mot de passe demandé, aucun montage avec identifiants, aucun
secret VPN, aucune validation TLS désactivée. Ces interdits sont vérifiés par
assertion sur **chaque script généré**, dans les deux modes — et chaque motif
de détection est lui-même éprouvé sur un script fautif fabriqué, pour qu'un
contrôle qui ne trouve jamais rien ne passe pas pour un contrôle qui valide.

### La validation TLS, en particulier

`http-https-tls-test` ne propose aucune option pour l'ignorer. C'est tentant —
un `-SkipCertificateCheck` fait disparaître l'erreur et donne l'impression
d'avancer. Il fait surtout disparaître le **diagnostic** : on ne sait plus si
le certificat était expiré, mal nommé, ou signé par une autorité inconnue. Et
un contournement posé « juste pour tester » reste en place des années.

Le certificat est donc lu **séparément** de la requête, pour obtenir la raison
exacte d'un refus même quand la requête échoue.

---

## 8. Les interdits se jugent sur le code, pas sur les commentaires

Plusieurs scripts expliquent en toutes lettres qu'ils n'appellent jamais
`key=clear`, qu'ils ne lancent pas `ping -t`, qu'ils n'ajoutent pas
`-SkipCertificateCheck`. Une première version des contrôles les a fait échouer
sur ces explications.

Les contrôles filtrent donc les lignes de commentaire et les `Write-Host` avant
de chercher un motif interdit. Une explication qui dit **pourquoi** un interdit
existe ne doit pas faire échouer le contrôle de cet interdit.

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

Et elle s'accompagne de quatre contrôles nouveaux qui valent pour **tous** les
scripts, exception comprise : pas de `DownloadString`, pas de `-OutFile`, pas
de requête dirigée vers une exécution, pas de `Start-BitsTransfer`. Le filet
est plus serré après qu'avant.

---

## 10. Client, pas serveur

DHCP et DNS apparaissent dans ce lot, et c'est voulu — mais côté **client**.

Le rôle DHCP Server et le rôle DNS Server restent dans Windows Server, et les
deux assistants concernés le disent **dès la première ligne de leur rapport**.
« Problème DHCP » recouvre deux choses très différentes : un poste qui n'obtient
pas de bail, et un service qui n'en distribue plus. Le second ne se diagnostique
pas depuis le poste qui le subit.

---

## 11. Deux défauts trouvés en chemin

Les contrôles ont attrapé deux choses pendant la construction du lot. Elles
sont corrigées, et nommées ici plutôt que glissées dans un commit.

**`smbFormat` était déjà pris.** `smb-sessions-diagnostic`, du LOT 2, porte un
champ de ce nom. Lui donner une valeur dans un jeu de données changeait ses
scripts figés. Le champ du LOT 5 est renommé `smbcFormat`. Renommer le nouveau
plutôt que de toucher l'ancien est la seule option : la garde d'identité existe
pour interdire la seconde.

**`validerCibleReseau` acceptait « 256.1.1.1 ».** Parce que la chaîne contient
des points, elle partait vers la validation de nom complet, qui l'acceptait
comme nom d'hôte. Quatre groupes de chiffres séparés par des points sont
désormais jugés comme une tentative d'adresse IPv4, et refusés comme telle.

---

## 12. La sous-rubrique « Adressage IP »

La catégorie Réseau compte **23** assistants : les 22 de ce lot, plus
`static-ip`, qui existe depuis le LOT 1 sous la sous-rubrique « Adressage IP ».

Il n'a pas été déplacé. Changer sa sous-rubrique changerait ses scripts
générés, et la garde d'identité est là pour l'interdire. Les huit sous-rubriques
demandées sont créées, et aucune autre : la neuvième préexistait.

---

## 13. Ce que ce lot ne prouve pas

Aucun de ces vingt-deux assistants n'a été exécuté sur une vraie machine
Windows, sur un vrai réseau, ni contre un vrai domaine.

Ce qui est prouvé : la génération, l'analyse syntaxique PowerShell 7, le
comportement du navigateur, la justesse du calculateur sur des cas connus, et
les contre-épreuves.

Ce qui ne l'est pas : le comportement de `Test-NetConnection`, `Get-NetRoute`,
`Get-NetNeighbor` ou `netsh wlan` sur un parc vivant. Cela demande un
laboratoire, et cela reste à faire.
