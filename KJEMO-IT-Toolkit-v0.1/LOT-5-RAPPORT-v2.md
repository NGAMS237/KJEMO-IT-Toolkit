> **LA V2 REMPLACE `LOT-5-RESEAU-AVANCE.patch`. NE PAS APPLIQUER LES DEUX.**
> `LOT-5-RESEAU-AVANCE-v2.patch` ne se pose **pas** par-dessus l'ancien patch
> LOT 5 : il part exactement de l'arbre obtenu après
> `LOT-4-CORRECTIF-GPOBACKUP.patch` et contient l'intégralité du LOT 5,
> corrections de la revue comprises. Si l'ancien patch a déjà été appliqué,
> défaire cette branche avant d'appliquer la V2.

# LOT 5 — Réseau avancé · rapport v2

**Dépôt** : `NGAMS237/KJEMO-IT-Toolkit`
**Branche** : `claude/lot-5-reseau-avance`
**SHA de base** : `4c37ce2` — le LOT 4 **corrigé**, pas `main`.

`origin/main` est à `a84a85c`. **Ni le LOT 3, ni le LOT 4, ni le LOT 5 n'y
sont.** Le travail se poursuit donc depuis la branche qui contient réellement
tout le LOT 4 corrigé.

---

## 0. Ce que cette version corrige

La revue a prononcé **CHANGES REQUESTED** sur deux défauts fonctionnels de
sécurité et une métadonnée fausse. Les trois sont corrigés. Elle a aussi relevé
quatre affirmations fausses dans le rapport v1 : elles sont corrigées ici, et
chacune est signalée à l'endroit où elle figurait.

| # | Reproche | État |
|---|---|---|
| 1 | `dns-client-change` éprouvait les serveurs DNS sans que le résultat bloque `Set-DnsClientServerAddress` | **corrigé**, §3 |
| 2 | `route-manager` calculait `$joignableDirectement` sans que `New-NetRoute` en dépende | **corrigé**, §4 |
| 3 | les 176 nouveaux scripts portaient `LOT 2 — 2.0.0` | **corrigé**, §5 |
| 4 | quatre affirmations fausses dans le rapport | **corrigées**, §6 |
| 5 | non-régression complète et livraison v2 | **fait**, §7 à §12 |

### Les quatre affirmations fausses du rapport v1

| Affirmation v1 | Correction, vérifiée |
|---|---|
| « 1 (correctif LOT 4) + 9 (LOT 5) » | **11 commits de LOT 5** avant ce correctif, pas 9. `git rev-list --count 4c37ce2..04d4c81` = 11. |
| « Trois assistants seulement écrivent » | **Quatre** assistants peuvent modifier l'état réseau : `arp-neighbor-diagnostic` appelle `Remove-NetNeighbor` en mode Appliquer. |
| `network-baseline` rangé sans précision | Il **écrit des fichiers de capture** (`New-Item`, `Set-Content`, `Export-Csv`, JSON). C'est une **écriture de rapport**, pas une modification de configuration. |
| comptes du registre des commandes donnés en bloc | Ils sont **par étape** : après correctif LOT 4, **154 cmdlets et 18 binaires** ; après LOT 5, **172 cmdlets et 19 binaires**. Les deux chiffres ont été relevés en exécutant `test/cmdlets-export.mjs` sur chacun des deux arbres. |

### Modifier une configuration, ou écrire un rapport

La distinction manquait, et elle compte : un assistant qui dépose un fichier
sur le Bureau ne met personne en danger ; un assistant qui change les serveurs
DNS d'une carte peut faire perdre une machine distante.

| Nature | Ce que cela veut dire | Assistants |
|---|---|---|
| **Modification de configuration** | change l'état de la machine ou du réseau ; exige un mode, une sauvegarde et une annulation | `dns-cache-reset`, `dns-client-change`, `route-manager`, `arp-neighbor-diagnostic` — **quatre** |
| **Écriture de rapport** | dépose un fichier de sortie ; ne change aucun réglage | `network-baseline` (fichiers de capture), et tout assistant dont le format de rapport n'est pas `Console` |
| **Lecture seule** | n'écrit rien du tout | les dix-huit autres |

---

## 1. Les vingt-deux assistants

| # | Identifiant | Sous-rubrique | Risque | Modifie la configuration ? | Écrit un fichier ? |
|---|---|---|---|---|---|
| 1 | `network-full-report` | Vue d’ensemble | diagnostic | non | rapport, si format ≠ Console |
| 2 | `network-baseline` | Vue d’ensemble | diagnostic | **non** | **oui — fichiers de capture** |
| 3 | `ping-traceroute` | Connectivité IP | diagnostic | non | rapport |
| 4 | `latency-packet-loss` | Connectivité IP | diagnostic | non | rapport |
| 5 | `gateway-diagnostic` | Connectivité IP | diagnostic | non | rapport |
| 6 | `ip-conflict-detection` | Connectivité IP | diagnostic | non | rapport |
| 7 | `adapter-metric-multihoming` | Connectivité IP | diagnostic | non | rapport |
| 8 | `dns-client-diagnostic` | Résolution de noms | diagnostic | non | rapport |
| 9 | `dns-cache-reset` | Résolution de noms | **caution** | **oui — vide le cache DNS** | non |
| 10 | `dns-client-change` | Résolution de noms | **caution** | **oui — serveurs DNS d’une carte** | non |
| 11 | `tcp-port-test` | Ports et protocoles | diagnostic | non | rapport |
| 12 | `rpc-connectivity-test` | Ports et protocoles | diagnostic | non | rapport |
| 13 | `ldap-ldaps-connectivity` | Ports et protocoles | diagnostic | non | rapport |
| 14 | `smb-connectivity-test` | Ports et protocoles | diagnostic | non | rapport |
| 15 | `http-https-tls-test` | Ports et protocoles | diagnostic | non | rapport |
| 16 | `route-table-diagnostic` | Routage et voisinage | diagnostic | non | rapport |
| 17 | `route-manager` | Routage et voisinage | **caution** | **oui — une route statique** | sauvegarde CSV de la table |
| 18 | `arp-neighbor-diagnostic` | Routage et voisinage | **caution** | **oui — `Remove-NetNeighbor` sur une entrée nommée** | rapport |
| 19 | `dhcp-client-diagnostic` | Routage et voisinage | diagnostic | non | rapport |
| 20 | `network-share-diagnostic` | Accès aux ressources | diagnostic | non | rapport |
| 21 | `wifi-vpn-diagnostic` | Sans-fil et VPN | diagnostic | non | rapport |
| 22 | `ipv4-subnet-calculator` | Calculs réseau | diagnostic | non | rapport |

**Dix-huit sur vingt-deux ne modifient aucune configuration.** Les quatre
autres sont nommés ci-dessus — c'est la correction du rapport v1, qui en
annonçait trois.

### Catégorie et sous-rubriques

Tout reste dans la catégorie principale **Réseau**. Aucune catégorie principale
DNS, DHCP, VPN, Wi-Fi, SMB ou Sécurité réseau n'a été créée — une assertion le
vérifie, nommément, pour chacune des six.

Les huit sous-rubriques demandées existent et sont les seules portées par les
nouveaux assistants. La catégorie en montre **neuf** : `static-ip` occupe
« Adressage IP » depuis le LOT 1. Il n'a pas été déplacé — changer sa
sous-rubrique changerait ses scripts générés, et la garde d'identité est là
pour l'interdire.

---

## 2. Comptages

| | Avant LOT 5 | Après LOT 5 |
|---|---|---|
| Outils au catalogue | 55 | **77** |
| Scripts générés | 440 | **616** |
| Scripts figés par la référence | 440 | 440 |
| Empreintes distinctes parmi les nouveaux | — | **176 / 176** |

Les 440 scripts d'avant le LOT 5 sont identiques **octet par octet**, y compris
après le changement de métadonnée de version du §5.

### Registre des commandes externes, par étape

| Étape | Applets de commande déclarées | Binaires Windows déclarés | Commandes bannies |
|---|---|---|---|
| Après `LOT-4-CORRECTIF-GPOBACKUP.patch` (`4c37ce2`) | **154** | **18** | 8 |
| Après le LOT 5 v2 | **172** | **19** | 8 |

Les deux lignes ont été relevées en exécutant `node test/cmdlets-export.mjs`
sur chacun des deux arbres, pas déduites l'une de l'autre. Le binaire ajouté
par le LOT 5 est `netsh`.

---

## 3. Défaut 1 — `dns-client-change` bloque réellement

### Ce qui n'allait pas

Le script éprouvait les serveurs DNS demandés, et le résultat n'entrait dans
aucune décision. La garde du mode Appliquer se réduisait à :

```powershell
if ($Mode -eq 'Appliquer' -and $adaptateur) {
```

Un serveur injoignable était signalé **ATTENTION**, puis imposé quand même. Sur
une machine distante, cela coupe la résolution de noms et la session avec.

### Ce qui change

**Un champ obligatoire : « Nom DNS servant d’épreuve »**, de valeur par défaut
`www.microsoft.com` — publique, et clairement remplaçable : le texte d'aide
demande explicitement de la remplacer par un nom interne (`dc01.exemple.local`)
quand les serveurs visés sont des serveurs d'annuaire, parce qu'un serveur
interne parfaitement sain peut n'avoir aucune résolution vers l'extérieur.

Une **adresse** y est refusée, avec son propre message : interroger un serveur
DNS avec une adresse déclenche une résolution inverse, qui échoue sur des
serveurs sains et ne prouverait rien.

**Une requête DNS réelle, serveur par serveur** :

```powershell
Resolve-DnsName -Name $NomTest -Server $s -Type A -DnsOnly -NoHostsFile -ErrorAction Stop
```

`-DnsOnly` écarte LLMNR et NetBIOS, `-NoHostsFile` écarte le fichier hosts :
sans eux, l'épreuve pourrait réussir sans que le serveur visé ait rien dit. La
durée est mesurée au chronomètre et rapportée.

**Six issues distinguées**, parce qu'elles n'appellent pas la même correction :

| Issue | Ce que cela veut dire | Verrou |
|---|---|---|
| `REPONSE` | le serveur a renvoyé au moins un enregistrement A | ✅ |
| `REPONSE SANS ADRESSE` | il a répondu, mais sans A pour ce nom | ❌ |
| `DELAI DEPASSE` | rien dans le délai : arrêté, filtré, hors de portée | ❌ |
| `REFUS` | il a répondu en refusant (récursion coupée, client non autorisé) | ❌ |
| `REPONSE NEGATIVE` | il affirme que ce nom n'existe pas | ❌ |
| `SILENCE` | aucune réponse exploitable | ❌ |

**Le port TCP 53 n'est plus une preuve.** Il reste mesuré, et le rapport le
qualifie en toutes lettres d'« indication seule, non probante ». Un pare-feu
peut accepter la connexion TCP sans qu'aucun service DNS ne réponde derrière,
et un serveur DNS sain peut ne pas écouter en TCP.

**Le verrou** : `$serveursDnsValides` ne passe à `$true` que si la liste
demandée n'est pas vide **et** qu'aucun serveur n'est en échec.

**Le mode Appliquer exige quatre conditions simultanées** :

```powershell
$conditionsAppliquer = ($null -ne $adaptateur) -and $etatPrecedentReleve `
                       -and $annulationConstruite -and $serveursDnsValides
```

À défaut : un résultat **PROBLEME** qui énumère ce qui manque, un résultat
**IGNORE** pour l'écriture, un bloc `--- Modification BLOQUEE ---` à l'écran
**nommant le serveur qui a bloqué**, et **aucun appel** à
`Set-DnsClientServerAddress`.

**La simulation ne ment plus.** En mode Diagnostic, elle annonce soit « les
quatre conditions sont réunies », soit « le script SERAIT BLOQUÉ et n'écrirait
rien », suivi de la liste de ce qui manque.

### La preuve : `test/dns-change-bloquant.test.mjs`

Le script est **réellement exécuté** sous PowerShell, dans une session où
`Set-DnsClientServerAddress` et `Clear-DnsClientCache` sont remplacés par des
mouchards qui consignent chaque appel. Une recherche textuelle ne prouverait
rien ici : ce qui est mesuré, c'est le nombre d'appels.

**Le banc rend `Test-NetConnection` toujours positif.** C'est délibéré : si la
décision du script s'appuyait encore sur le port 53, la passe A écrirait.

| Passe | Décor | Attendu | Obtenu |
|---|---|---|---|
| A | un serveur DNS sur deux ne répond pas | 0 appel | **0** |
| B | tous répondent (contrôle positif) | exactement 1 appel | **1** |
| C | la carte est introuvable | 0 appel | **0** |
| D | l'état précédent n'est pas relevable | 0 appel | **0** |
| E | **le verrou est désarmé** | le test doit voir l'appel interdit | **détecté (1 appel)** |
| F | `--powershell` pointe un interpréteur absent | le test échoue, sans repli | **conforme** |

**28 assertions, 0 échec** sous PowerShell 7.4.6.

La passe B n'est pas facultative : sans elle, un journal vide en passe A
pourrait vouloir dire que les mouchards ne se déclenchent jamais. La passe E
non plus : un test incapable d'échouer ne prouve rien.

---

## 4. Défaut 2 — `route-manager` bloque réellement

### Ce qui n'allait pas

```powershell
if ($Mode -eq 'Appliquer' -and $adaptateur -and $sauvegardeOk) {
```

`$joignableDirectement` était calculé, affiché, puis ignoré. Une passerelle
hors de tout préfixe directement connecté produit une route que Windows accepte
parfois et par laquelle le trafic disparaît sans message.

### Ce qui change

**L'arithmétique de préfixe est refaite, et nommée.** Elle vit désormais dans
une fonction du script, `Test-KjemoMemePrefixe`, calculée en `[int64]` par
multiplications et divisions entières :

```powershell
$taille = [int64][Math]::Pow(2, 32 - $Prefixe)
return ([int64][Math]::Floor($va / $taille)) -eq ([int64][Math]::Floor($vb / $taille))
```

Aucun décalage binaire, aucun `-band`. Les opérateurs binaires de PowerShell
sont signés et `[int]` déborde à 4 294 967 295 : un masque construit par
décalage devient négatif dès que le premier octet dépasse 127 — faux pour
`240.0.0.0/4`, juste pour `192.168.1.0/24`. C'est l'erreur qui passe tous les
essais faits à la main.

L'ancienne comparaison octet par octet, avec son masque partiel en
`[Math]::Pow`, est remplacée.

**Le mode Appliquer exige cinq conditions simultanées** :

```powershell
$conditionsAppliquer = ($null -ne $adaptateur) -and $joignableDirectement `
                       -and $sauvegardeOk -and $annulationConstruite -and $ConfirmationOk
```

- carte trouvée ;
- passerelle appartenant à un préfixe **directement connecté à cette carte** ;
- sauvegarde de la table réussie ;
- commande d'annulation construite ;
- confirmation renforcée de la route par défaut satisfaite.

À défaut : **PROBLEME** énumérant ce qui manque, **IGNORE** pour l'action, un
bloc `--- Pose BLOQUEE ---` qui **énumère les préfixes réellement portés par la
carte** et nomme la correction attendue, et **aucun appel** à `New-NetRoute`.

**L'écho ICMP n'est plus une condition**, et n'est même plus classé
`ATTENTION` : il passe en `INFO`, annoncé comme indication non probante. Une
passerelle peut refuser ICMP et router parfaitement ; une passerelle peut
répondre à l'écho et ne rien router.

**La route par défaut garde sa confirmation écrite distincte**, inchangée :
`JE REMPLACE LA ROUTE PAR DEFAUT`, exigée par le formulaire, et désormais
portée dans le script lui-même (`$ConfirmationOk`) pour qu'un script relu hors
du site montre aussi pourquoi il accepte ou refuse.

### La preuve : `test/route-passerelle-bloquante.test.mjs`

**Volet 1 — l'arithmétique, exécutée cas par cas.** Le script est dot-sourcé,
ce qui laisse `Test-KjemoMemePrefixe` dans la portée du banc : le test
l'interroge directement, au lieu de deviner son comportement depuis le rapport.

| Préfixe | Cas vrai | Cas faux |
|---|---|---|
| **/9** | `10.0.0.5` ∋ `10.127.255.254` | ∌ `10.128.0.1` |
| **/17** | `172.16.5.5` ∋ `172.16.127.254` | ∌ `172.16.128.1` |
| **/23** | `192.168.10.5` ∋ `192.168.11.254` | ∌ `192.168.12.1` |
| **/25** | `192.168.1.130` ∋ `192.168.1.129` | ∌ `192.168.1.126` (même /24, pourtant) |
| **/30** | `10.1.1.5` ∋ `10.1.1.6` | ∌ `10.1.1.8` |
| **/31** | `10.1.1.4` ∋ `10.1.1.5` | ∌ `10.1.1.6` |
| /32 | `203.0.113.5` ∋ lui-même | ∌ `203.0.113.6` |
| /1, /4 | `200.0.0.1` ∋ `250.1.1.1`, `240.0.0.1` ∋ `250.1.1.1` | ∌ `10.0.0.1`, ∌ `239.255.255.255` |
| /24 | `192.168.30.10` ∋ `192.168.30.254` | ∌ `10.20.30.1` |

Les six préfixes demandés par la revue — /9, /17, /23, /25, /30, /31 — y sont.
Le /1 et le /4 sont le piège du bit de signe. Le /24 est le **contrôle
négatif** : il réussit même quand le calcul est faux, et ne prouve donc rien
tout seul. **20 cas sur 20 justes.**

**Volet 2 — le blocage réel.** `New-NetRoute` est remplacé par un mouchard.
L'aperçu `-WhatIf` est consigné **sous un autre nom** : ce n'est pas une
écriture, et le confondre avec une pose fausserait le comptage.

**Le banc rend `Test-Connection` toujours positif.** Si l'écho entrait encore
dans la décision, la passe A poserait la route.

| Passe | Décor | Attendu | Obtenu |
|---|---|---|---|
| A | passerelle hors du sous-réseau | 0 pose | **0** |
| B | passerelle dans le sous-réseau (contrôle positif) | exactement 1 pose | **1** |
| C | sauvegarde de la table en échec | 0 pose | **0** |
| D | carte introuvable | 0 pose | **0** |
| E | **le verrou est retiré** | le test doit voir la pose interdite | **détecté (1 pose)** |
| F | `--powershell` pointe un interpréteur absent | le test échoue, sans repli | **conforme** |

**51 assertions, 0 échec** sous PowerShell 7.4.6.

---

## 5. Métadonnée de version des scripts LOT 5

### Ce qui n'allait pas

Les 176 nouveaux scripts annonçaient `LOT 2 — 2.0.0`, en en-tête et dans
`$KjemoVersion`, par héritage du gabarit commun. Un rapport remonté du terrain
devient inexploitable quand sa ligne de version désigne un autre lot que celui
dont l'outil provient.

### Ce qui change

Le gabarit prend un paramètre **facultatif** :

- `enteteScript({ ..., version })` — défaut `VERSION_OUTILS` ;
- `assembler({ ..., version })` — omis, il ne transmet rien, de sorte que
  l'en-tête produit est **rigoureusement** celui d'avant.

`VERSION_OUTILS` **reste** `LOT 2 — 2.0.0`. C'est précisément ce qui laisse les
440 scripts figés identiques octet pour octet. Changer cette constante
migrerait tout le catalogue d'un coup.

Les 22 assistants du LOT 5, **et eux seuls**, passent
`VERSION_RESEAU = 'LOT 5 — Réseau avancé — 5.0.0'`.

### Les trois assertions demandées

Vérifiées sur les **fichiers eux-mêmes** par `test/generate-ps1.mjs` :

| Assertion | Résultat |
|---|---|
| les nouveaux scripts portent la version LOT 5 | **176 / 176** |
| aucun nouveau script ne porte `LOT 2 — 2.0.0` | **0** |
| les anciens scripts restent identiques octet par octet | **440 / 440** |

Et au niveau des outils, par `test/identity.test.mjs` : tous les scripts du lot
annoncent la bonne version en en-tête **et** dans `$KjemoVersion` ; aucun outil
antérieur n'est contaminé ; plus une **contre-épreuve** qui exige que le
paramètre ait réellement un effet — un gabarit qui l'ignorerait ferait passer
tout le reste.

### Dette historique — constatée, NON corrigée ici

Elle est consignée à chaque exécution de `test/generate-ps1.mjs` :

| Constat | Nombre |
|---|---|
| scripts antérieurs portant encore `LOT 2 — 2.0.0`, **y compris ceux des LOTS 3 et 4** | **376** |
| scripts du LOT 1 ne passant pas par le gabarit commun, donc sans aucune ligne de version | **64** |

Répartition des 376 : 112 du LOT 2 (légitimes), **120 du LOT 3 et 144 du
LOT 4** (à migrer).

Les corriger ici réécrirait les 440 scripts figés — exactement ce que la garde
d'identité interdit. Ils attendent une **migration globale explicitement
autorisée**.

---

## 6. Résultats des tests

Chaque ligne dit **de quelle nature** est la preuve.

### 6.1 Génération (exécution de `generate()` en JavaScript)

| Contrôle | Résultat |
|---|---|
| `node --check` sur tous les modules et `app.js` | **OK** |
| 8 jeux de données par outil | **616 scripts, 0 erreur** |
| `generate()` en mode `Appliquer` pour les 4 outils qui modifient | **OK** — `arp-neighbor-diagnostic` refuse sans adresse nommée, comportement voulu |
| Identité des 440 scripts d'avant le lot | **440 / 440 identiques** |
| Empreintes distinctes parmi les 176 nouveaux | **176 / 176** |
| Version LOT 5 sur les nouveaux scripts | **176 / 176**, 0 reste en LOT 2 |
| BOM UTF-8 | **OK** |
| **Total `identity.test.mjs`** | **29 010 OK, 0 ÉCHEC** |

Le total passe de 28 855 à 29 010 : les 155 assertions ajoutées sont celles de
la métadonnée de version et de sa contre-épreuve.

### 6.2 Analyse syntaxique

| Contrôle | Résultat |
|---|---|
| `Parser::ParseFile` sur les 616 scripts | **616, 0 échec** |
| Contrôle des commandes externes (grammaire AST, pas regex) | **616 scripts, 162 commandes distinctes, 0 échec**, 2 contre-épreuves OK |
| Aucune apostrophe typographique dans un script généré | **OK** |

### 6.3 Exécution PowerShell 7

Ce qui a **réellement tourné** sur cette machine, avec PowerShell 7.4.6 :

| Contrôle | Résultat |
|---|---|
| Analyse des 616 scripts | **616, 0 échec** |
| Aller-retour Unicode JS → .ps1 → PowerShell → JSON | **16 OK, 0 ÉCHEC** |
| Contre-épreuve de sauvegarde bloquante (LOT 3) | **21 OK, 0 ÉCHEC** |
| **Contre-épreuve du changement DNS bloquant (nouveau)** | **28 OK, 0 ÉCHEC** |
| **Contre-épreuve de la passerelle bloquante (nouveau)** | **51 OK, 0 ÉCHEC** |
| Banc de contrôle des commandes | **0 échec** |

### 6.4 Exécution Windows PowerShell 5.1

**NON EXÉCUTÉ.** Cette machine est sous Linux ; Windows PowerShell 5.1 n'y
existe pas et ne peut pas y être installé. Ni l'analyse, ni les trois
contre-épreuves d'exécution, ni le contrôle des commandes n'ont tourné sous ce
moteur.

**Ce n'est pas déclaré réussi par déduction.** Les étapes sont branchées dans
`.github/workflows/validate.yml`, sur `windows-latest`, avec `powershell.exe`
nommément. Les deux nouvelles contre-épreuves y ont été ajoutées, chacune sous
les deux moteurs, **sans `continue-on-error` et sans `if` permissif** : le
workflow s'arrête si l'une échoue. Elles attendent un agent.

### 6.5 Tests navigateur (Chromium réel, Playwright, site servi en local)

**3 904 OK, 0 ÉCHEC.** Copier / aperçu / téléchargement identiques hors BOM et
CRLF, routes directes, recherche, favoris, modes Débutant et Technicien, thèmes
clair / sombre / système, responsive 390 px à 0 px de débordement mesuré,
accessibilité clavier, stockage local bloqué.

### 6.6 Sources Microsoft

**496 contrôles OK, 0 échec** en mode hors ligne (aucune URL rappelée dans
cette passe ; la vérification en ligne des 248 URL distinctes, par code **et**
par titre, date de la session de construction et avait trouvé et remplacé
3 liens morts).

### 6.7 Ce qui n'a PAS été fait

| | |
|---|---|
| Exécution sur une vraie machine Windows | **AUCUNE** |
| Exécution sur un vrai réseau | **AUCUNE** — aucun `Test-NetConnection`, `Get-NetRoute`, `Get-NetNeighbor`, `Resolve-DnsName` ni `netsh wlan` réel |
| Exécution contre un vrai domaine | **AUCUNE** |
| Windows PowerShell 5.1 | **NON EXÉCUTÉ** |
| GitHub Actions | **aucune exécution** |

Dans les deux nouveaux bancs, `Resolve-DnsName`, `New-NetRoute`,
`Test-NetConnection` et `Test-Connection` sont des **doublures**. Ce qui est
prouvé, c'est la **logique de blocage du script**, pas le comportement de ces
cmdlets sur un parc vivant.

---

## 7. Validateurs et contre-épreuves

### 7.1 Nouveaux validateurs

`validerPort`, `validerListePorts`, `validerDelaiMs`, `validerNombreEssais`,
`validerCibleReseau`, `validerUrlHttpOuHttps`, `validerPlageDecouverte`,
`estPlagePrivee`, `validerConcurrence`, `validerNomProfilWifi`,
`validerIndexInterface`, `validerSuffixeDns`, plus les constantes
`PORTS_MAX_PAR_LISTE`, `PREFIXE_DECOUVERTE_MIN`, `HOTES_DECOUVERTE_MAX`.

Aucun validateur existant n'est dupliqué.

Refus qui méritent d'être nommés :

- intervalles de ports (`1-1024`) : refusés, parce que nommer chaque port est
  ce qui sépare un test d'un balayage ;
- plus de vingt ports : refusés, avec le plafond dans le message ;
- `256.1.1.1` : refusé comme adresse IPv4 invalide, et non accepté comme nom
  d'hôte parce qu'il contient des points ;
- préfixes `-1`, `33`, `024` : refusés ;
- `192.168.30.1/24` : refusé, « n'est pas une adresse de réseau », avec
  l'adresse corrigée proposée ;
- **nouveau** : une adresse dans le champ « nom DNS d’épreuve » de
  `dns-client-change`, avec son propre message.

### 7.2 Calculateur IPv4 — les six cas demandés

| Cas | Masque | Réseau | Diffusion | Première | Dernière | Total | Utilisables |
|---|---|---|---|---|---|---|---|
| `192.168.30.254/24` | 255.255.255.0 | 192.168.30.0 | 192.168.30.255 | .1 | .254 | 256 | **254** |
| `192.168.30.0/24` | 255.255.255.0 | 192.168.30.0 | 192.168.30.255 | .1 | .254 | 256 | **254** |
| `10.0.0.1/8` | 255.0.0.0 | 10.0.0.0 | 10.255.255.255 | 10.0.0.1 | 10.255.255.254 | 16 777 216 | **16 777 214** |
| `172.16.5.130/26` | 255.255.255.192 | 172.16.5.128 | 172.16.5.191 | .129 | .190 | 64 | **62** |
| `192.168.1.10/31` | 255.255.255.254 | 192.168.1.10 | *sans objet* | .10 | .11 | 2 | **2** |
| `192.168.1.10/32` | 255.255.255.255 | 192.168.1.10 | *sans objet* | .10 | .10 | 1 | **1** |

Les trente-trois préfixes de /0 à /32 sont parcourus, et aucun ne produit
d'octet négatif ni de compte négatif.

### 7.3 Contre-épreuves de calcul

1. **L'erreur classique.** Un calcul délibérément faux retire deux adresses y
   compris en /31. Le test exige qu'il **diffère** du calcul juste — 0 contre
   2 — et un contrôle positif montre que la même erreur est **invisible en
   /24**.
2. **L'arithmétique signée.** Le test vérifie que `(0xFFFFFFFF << 8)` est bien
   négatif en JavaScript, et que la même valeur en BigInt reste positive.
3. **Nouveau, côté PowerShell.** Les vingt cas de `Test-KjemoMemePrefixe` du
   §4, dont le /1 et le /4 qui débordent avec des opérateurs signés.

### 7.4 Les dix contre-épreuves de sécurité

| # | Risque | Résultat |
|---|---|---|
| 1 | Scan public — 5 plages publiques refusées, cause nommée | détecté |
| 2 | Scan trop large — /8, /12, /16, /23 refusés, plafond nommé | détecté |
| 3 | Mot de passe dans le script | détecté |
| 4 | Clé Wi-Fi affichée (`key=clear`) | détecté |
| 5 | TLS ignoré | détecté |
| 6 | Pare-feu désactivé | détecté |
| 7 | Ping infini / `while ($true)` | détecté |
| 8 | `-Confirm:$false` | détecté |
| 9 | Route par défaut supprimée | détecté |
| 10 | Script historique modifié | détecté |

Chaque motif est éprouvé sur un script fautif fabriqué : un contrôle qui ne
trouve jamais rien ne doit pas passer pour un contrôle qui valide. Aucun des 23
scripts de la catégorie Réseau ne porte un de ces motifs, dans aucun mode.

---

## 8. Architecture

| Fichier | Nature |
|---|---|
| `dist/outils-reseau.mjs` | **créé** — les 22 assistants, et `VERSION_RESEAU` |
| `dist/calcul-ip.mjs` | **créé** — arithmétique IPv4 en BigInt |
| `dist/validateurs.mjs` | étendu — aucun doublon |
| `dist/rapport-ps.mjs` | **modifié v2** — `enteteScript` prend `version`, facultatif |
| `dist/outils-serveur.mjs` | **modifié v2** — `assembler` transmet `version` si elle est fournie |
| `dist/generators.mjs` | **+2 lignes** — un `import`, une boucle |
| `test/scripts-baseline.json` | référence refigée sur `4c37ce2`, 440 scripts, quatrième ancrage |
| `test/identity.test.mjs` | section LOT 5, contre-épreuves, **section version v2** |
| `test/generate-ps1.mjs` | valeurs Réseau, **assertions de version et dette historique v2** |
| `test/dns-change-bloquant.test.mjs` | **créé v2** |
| `test/route-passerelle-bloquante.test.mjs` | **créé v2** |
| `test/captures-lot5.mjs` | **créé** — production des preuves visuelles |
| `.github/workflows/validate.yml` | **modifié v2** — 4 étapes bloquantes ajoutées |
| `package.json` | **modifié v2** — deux scripts npm, `npm test` enchaîné |

Aucune dépendance ajoutée, aucun framework, aucun bundler, aucun backend,
aucune télémétrie, aucun CDN, aucun secret. `dist/app.js` n'est pas modifié.

---

## 9. Captures

Dans `docs/captures-lot5/` : accueil clair et sombre en 1440 px, recherche,
fiche en modes Débutant et Technicien, refus de validation en gros plan,
aperçu du rapport réseau, trois vues à 390 px à 0 px de débordement, et deux
vues du calculateur montrant le calcul `172.16.5.130/26` tel qu'il apparaît
dans l'aperçu — sans que rien ait été exécuté.

---

## 10. Limites connues

1. **Aucune exécution sur une vraie machine Windows, un vrai réseau, un vrai
   domaine.** C'est la limite principale, et elle vaut pour les vingt-deux.
2. **Windows PowerShell 5.1 n'a pas été exécuté.** Seule la CI sur
   `windows-latest` peut le faire.
3. Les deux nouveaux bancs prouvent la **logique de blocage**, avec des
   cmdlets doublées. Ils ne disent rien du comportement réel de
   `Resolve-DnsName` ou de `New-NetRoute` sur un parc vivant.
4. L'épreuve DNS repose sur le **texte des messages d'erreur** pour distinguer
   délai, refus et réponse négative. Sous une version de Windows localisée
   autrement, une issue peut être rangée en `SILENCE` plutôt que dans sa
   catégorie exacte. **La décision ne change pas** : tout ce qui n'est pas une
   réponse avec adresse bloque la modification.
5. La gigue de `latency-packet-loss` est un écart-type d'aller-retours, pas la
   gigue au sens de la RFC 3550.
6. `ip-conflict-detection` ne conclut jamais : la preuve se prend sur le
   commutateur.
7. La comparaison de `network-baseline` ignore les compteurs et les adresses
   IPv6 temporaires.
8. Le calculateur couvre **IPv4 seulement**.
9. `rpc-connectivity-test` éprouve un échantillon de la plage dynamique : il ne
   peut pas dire qu'un service précis est joignable.
10. `wifi-vpn-diagnostic` ne reconnaît un client VPN tiers que par la
    description de son interface.
11. **Dette de version** : 376 scripts antérieurs et 64 scripts du LOT 1 ne
    portent pas la version de leur lot. Voir §5.

---

## 11. État de livraison

| | |
|---|---|
| Branche | `claude/lot-5-reseau-avance` |
| SHA de base | `4c37ce2` — LOT 4 corrigé |
| Commits du LOT 5 **avant** ce correctif | **11** — et non 9, comme l'annonçait le rapport v1 |
| Commits de ce correctif | **5** |
| Total porté par `LOT-5-RESEAU-AVANCE-v2.patch` | **16** |
| Poussé ? | **Non.** `access denied by the git proxy: NGAMS237/KJEMO-IT-Toolkit is not in this session's authorized repository set` → HTTP 403. Une seule tentative, aucun jeton demandé, aucune restriction contournée. |
| GitHub Actions | **aucune exécution** |
| Fusion dans `main` | **aucune** |
| Déploiement | **aucun** |

### Les cinq commits du correctif

| SHA | Objet |
|---|---|
| `a78946a` | `dns-client-change` bloque réellement avant d'écrire |
| `1354131` | `route-manager` bloque réellement avant de poser |
| `7ef8727` | les scripts du lot annoncent le LOT 5, pas le LOT 2 |
| `690b919` | les deux nouvelles contre-épreuves deviennent bloquantes en CI |
| *(le cinquième)* | rapport et décisions v2, avec les quatre affirmations corrigées — son propre SHA ne peut évidemment pas figurer dans le document qu'il introduit ; `git log --oneline 4c37ce2..HEAD` le donne |

---

## 12. Appliquer la V2 — commandes exactes (CMD Windows)

**`LOT-5-RESEAU-AVANCE-v2.patch` remplace `LOT-5-RESEAU-AVANCE.patch`.** Il ne
se pose pas par-dessus. Il contient les 16 commits, du premier commit du LOT 5
jusqu'au dernier du correctif.

```cmd
cd /d C:\chemin\vers\KJEMO-IT-Toolkit
git fetch origin

REM 1. Le correctif du LOT 4, sur la branche LOT 4 — INCHANGE
git checkout claude/lot-4-gpo-avance
git am LOT-4-CORRECTIF-GPOBACKUP.patch
git push origin claude/lot-4-gpo-avance

REM 2. Le LOT 5 v2, sur sa propre branche, depuis le LOT 4 corrige
git checkout -b claude/lot-5-reseau-avance
git am LOT-5-RESEAU-AVANCE-v2.patch
git push origin claude/lot-5-reseau-avance
```

Si l'ancien `LOT-5-RESEAU-AVANCE.patch` a déjà été appliqué sur cette branche,
la défaire d'abord :

```cmd
git checkout claude/lot-4-gpo-avance
git branch -D claude/lot-5-reseau-avance
```

### Vérification faite ici, et ce qu'elle vaut exactement

La V2 a été appliquée avec `git am` dans un **clone neuf**, créé avec
`git clone --no-hardlinks --no-local`, remis sur `4c37ce2` — c'est-à-dire
exactement l'arbre obtenu après `LOT-4-CORRECTIF-GPOBACKUP.patch`.

```
git am  → OK, 16 commits appliqués, aucun rejet
arbre résultant vs branche de travail → SHA d'arbre IDENTIQUE, 0 écart
```

Puis, dans ce clone de vérification et non dans l'arbre de travail :

| Contrôle | Résultat |
|---|---|
| `identity.test.mjs` | **29 010 OK, 0 ÉCHEC** |
| `generate-ps1.mjs` | 616 scripts, **440/440 identiques**, **176/176 en version LOT 5** |
| contre-épreuve DNS bloquant | **28 OK, 0 ÉCHEC** |
| contre-épreuve passerelle bloquante | **51 OK, 0 ÉCHEC** |

**Une précision honnête sur ce « clone neuf ».** Le dépôt de référence sur
GitHub ne porte ni le LOT 4 ni son correctif : `origin/main` est à `a84a85c`,
et les seules branches distantes vont jusqu'au LOT 3. Le clone de vérification
est donc un clone **du dépôt local**, sans partage d'objets, remis sur
`4c37ce2`. Ce qu'il établit : le patch s'applique proprement sur le bon arbre
de départ et reproduit exactement le résultat attendu. Ce qu'il n'établit pas :
que `4c37ce2` lui-même soit reproductible depuis GitHub — il ne l'est pas tant
que le LOT 4 et son correctif n'y sont pas poussés, ce qui est précisément
l'étape qui attend Blaise.

Les empreintes SHA-256 des quatre livrables figurent dans
`SHA256SUMS-LOT5-v2.txt`.

---

## Verdict

**READY FOR CODEX RE-REVIEW.**

Pas VALIDÉ, et le mot ne doit pas être employé tant que les deux contrôles
suivants n'auront pas réellement réussi :

1. Windows PowerShell 5.1 — analyse des 616 scripts et les **trois**
   contre-épreuves d'exécution, sur un agent `windows-latest` ;
2. une exécution en laboratoire, sur une vraie machine Windows, sur un vrai
   réseau.

Les deux défauts signalés par la revue sont corrigés, et chacun est prouvé par
un test qui **exécute réellement le script** et compte les appels interdits —
contre-épreuve comprise, parce qu'un test incapable d'échouer ne prouve rien.
