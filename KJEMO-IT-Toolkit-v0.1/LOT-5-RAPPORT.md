# LOT 5 — Réseau avancé · rapport

**Dépôt** : `NGAMS237/KJEMO-IT-Toolkit`
**Branche** : `claude/lot-5-reseau-avance`
**SHA de base** : `4c37ce2` — le LOT 4 **corrigé**, pas `main`.

`origin/main` est à `a84a85c`. **Ni le LOT 3, ni le LOT 4, ni le LOT 5 n'y
sont.** Le travail se poursuit donc depuis la branche qui contient réellement
tout le LOT 4 corrigé, comme demandé.

---

## 1. Les vingt-deux assistants

| # | Identifiant | Sous-rubrique | Risque | Écrit ? |
|---|---|---|---|---|
| 1 | `network-full-report` | Vue d’ensemble | diagnostic | non |
| 2 | `network-baseline` | Vue d’ensemble | diagnostic | fichiers de capture seulement |
| 3 | `ping-traceroute` | Connectivité IP | diagnostic | non |
| 4 | `latency-packet-loss` | Connectivité IP | diagnostic | non |
| 5 | `gateway-diagnostic` | Connectivité IP | diagnostic | non |
| 6 | `ip-conflict-detection` | Connectivité IP | diagnostic | non |
| 7 | `adapter-metric-multihoming` | Connectivité IP | diagnostic | non |
| 8 | `dns-client-diagnostic` | Résolution de noms | diagnostic | non |
| 9 | `dns-cache-reset` | Résolution de noms | **caution** | **vide le cache DNS** |
| 10 | `dns-client-change` | Résolution de noms | **caution** | **serveurs DNS d’une carte** |
| 11 | `tcp-port-test` | Ports et protocoles | diagnostic | non |
| 12 | `rpc-connectivity-test` | Ports et protocoles | diagnostic | non |
| 13 | `ldap-ldaps-connectivity` | Ports et protocoles | diagnostic | non |
| 14 | `smb-connectivity-test` | Ports et protocoles | diagnostic | non |
| 15 | `http-https-tls-test` | Ports et protocoles | diagnostic | non |
| 16 | `route-table-diagnostic` | Routage et voisinage | diagnostic | non |
| 17 | `route-manager` | Routage et voisinage | **caution** | **une route statique** |
| 18 | `arp-neighbor-diagnostic` | Routage et voisinage | **caution** | **une entrée de voisinage** |
| 19 | `dhcp-client-diagnostic` | Routage et voisinage | diagnostic | non |
| 20 | `network-share-diagnostic` | Accès aux ressources | diagnostic | non |
| 21 | `wifi-vpn-diagnostic` | Sans-fil et VPN | diagnostic | non |
| 22 | `ipv4-subnet-calculator` | Calculs réseau | diagnostic | non |

**Dix-neuf sur vingt-deux ne modifient rien.**

### Catégorie et sous-rubriques

Tout reste dans la catégorie principale **Réseau**. Aucune catégorie
principale DNS, DHCP, VPN, Wi-Fi, SMB ou Sécurité réseau n'a été créée — une
assertion le vérifie, nommément, pour chacune des six.

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

**77 outils et 616 scripts : les deux objectifs annoncés, atteints sans
arrondi.** Les 440 scripts d'avant le LOT 5 sont identiques octet par octet.

---

## 3. Résultats des tests

Chaque ligne dit **de quelle nature** est la preuve. C'est le point qui
compte le plus dans ce rapport.

### 3.1 Tests de génération (exécution de `generate()` en JavaScript)

| Contrôle | Résultat |
|---|---|
| `node --check` sur tous les modules | **OK** |
| `generate(defaults)` pour les 77 outils | **77 / 77, 0 erreur** |
| 8 jeux de données par outil | **616 scripts, 0 erreur** |
| `generate()` en mode `Appliquer` pour les 4 outils qui en proposent un | **OK** (`arp-neighbor-diagnostic` refuse sans adresse nommée — comportement voulu) |
| `validate()` sur valeurs valides **et** invalides | **OK** — voir §4 |
| Identité des 440 scripts d'avant le lot | **440 / 440 identiques** |
| Empreintes distinctes parmi les 176 nouveaux | **176 / 176** |
| BOM UTF-8 sur les 616 fichiers | **616 / 616** |
| **Total des assertions** `identity.test.mjs` | **28 855 OK, 0 ÉCHEC** |

### 3.2 Analyse syntaxique

| Contrôle | Résultat |
|---|---|
| `Parser::ParseFile` sur les 616 scripts | **616, 0 échec** |
| Contrôle des commandes externes (grammaire, pas regex) | **0 échec**, 2 contre-épreuves OK |
| Aucune apostrophe typographique dans un script généré | **OK** |

### 3.3 Exécution PowerShell 7

Ce qui a **réellement tourné** sur cette machine, avec PowerShell 7.4.6 :

| Contrôle | Résultat |
|---|---|
| Analyse des 616 scripts | **616, 0 échec** |
| Aller-retour Unicode JS → .ps1 → PowerShell → JSON | **16 OK, 0 ÉCHEC** |
| Contre-épreuve de sauvegarde bloquante (LOT 3) | **21 OK, 0 ÉCHEC** |
| Banc de contrôle des commandes | **0 échec** |

### 3.4 Exécution Windows PowerShell 5.1

**AUCUNE.** Cette machine est sous Linux ; Windows PowerShell 5.1 n'y existe
pas et ne peut pas y être installé. Ni l'analyse, ni la contre-épreuve, ni le
contrôle des commandes n'ont tourné sous ce moteur.

**Ils ne sont pas déclarés réussis par déduction.** Les étapes sont branchées
dans `.github/workflows/validate.yml`, qui les exécute sur `windows-latest`
avec `powershell.exe` nommément, et qui **refuse de tourner sous le mauvais
moteur** plutôt que de se replier. Elles attendent un agent.

### 3.5 Tests navigateur (Chromium réel, Playwright, site servi en local)

| Contrôle | Résultat |
|---|---|
| Copier / aperçu / téléchargement strictement identiques (hors BOM et CRLF) | **OK** |
| Routes directes `#/outil/<id>` | **OK** |
| Recherche par titre, catégorie et message d’erreur | **OK** |
| Favoris et historique | **OK** |
| Modes Débutant et Technicien | **OK** |
| Thèmes Clair, Sombre, Système | **OK** |
| Responsive 390 px | **OK — 0 px de débordement, mesuré** |
| Accessibilité clavier et focus visible | **OK** |
| Stockage local bloqué | **OK** |
| **Total des assertions** `browser-identity.test.mjs` | **3 904 OK, 0 ÉCHEC** |

### 3.6 Test sur une vraie machine Windows

**AUCUN.** Aucun script n'a été exécuté sur une machine Windows.

### 3.7 Test sur un vrai réseau

**AUCUN.** Aucun `Test-NetConnection`, `Get-NetRoute`, `Get-NetNeighbor`,
`Resolve-DnsName` ni `netsh wlan` n'a été appelé pour de vrai. Les seuls
appels réseau de cette session sont les requêtes HTTPS de vérification des
sources Microsoft.

### 3.8 Test sur un vrai domaine

**AUCUN.** Les assistants qui visent un contrôleur de domaine
(`ldap-ldaps-connectivity`, `rpc-connectivity-test`) n'ont jamais parlé à un
annuaire.

---

## 4. Validateurs et contre-épreuves

### 4.1 Nouveaux validateurs

`validerPort`, `validerListePorts`, `validerDelaiMs`, `validerNombreEssais`,
`validerCibleReseau`, `validerUrlHttpOuHttps`, `validerPlageDecouverte`,
`estPlagePrivee`, `validerConcurrence`, `validerNomProfilWifi`,
`validerIndexInterface`, `validerSuffixeDns`, plus les constantes
`PORTS_MAX_PAR_LISTE`, `PREFIXE_DECOUVERTE_MIN`, `HOTES_DECOUVERTE_MAX`.

Aucun validateur existant n'est dupliqué : la section est ajoutée à
`dist/validateurs.mjs`.

Testés en acceptation **et** en refus. Les refus qui méritent d'être nommés :

- intervalles de ports (`1-1024`) : refusés, parce que nommer chaque port est
  ce qui sépare un test d'un balayage ;
- plus de vingt ports : refusés, avec le plafond dans le message ;
- `256.1.1.1` : refusé comme adresse IPv4 invalide, et non accepté comme nom
  d'hôte parce qu'il contient des points ;
- préfixes `-1`, `33`, `024` : refusés ;
- `192.168.30.1/24` : refusé, « n'est pas une adresse de réseau », avec
  l'adresse corrigée proposée.

### 4.2 Calculateur IPv4 — les six cas demandés

| Cas | Masque | Réseau | Diffusion | Première | Dernière | Total | Utilisables |
|---|---|---|---|---|---|---|---|
| `192.168.30.254/24` | 255.255.255.0 | 192.168.30.0 | 192.168.30.255 | .1 | .254 | 256 | **254** |
| `192.168.30.0/24` | 255.255.255.0 | 192.168.30.0 | 192.168.30.255 | .1 | .254 | 256 | **254** |
| `10.0.0.1/8` | 255.0.0.0 | 10.0.0.0 | 10.255.255.255 | 10.0.0.1 | 10.255.255.254 | 16 777 216 | **16 777 214** |
| `172.16.5.130/26` | 255.255.255.192 | 172.16.5.128 | 172.16.5.191 | .129 | .190 | 64 | **62** |
| `192.168.1.10/31` | 255.255.255.254 | 192.168.1.10 | *sans objet* | .10 | .11 | 2 | **2** |
| `192.168.1.10/32` | 255.255.255.255 | 192.168.1.10 | *sans objet* | .10 | .10 | 1 | **1** |

Comparaisons vérifiées : même sous-réseau, sous-réseaux différents, et le cas
où changer le préfixe change la réponse.

Les trente-trois préfixes de /0 à /32 sont parcourus, et aucun ne produit
d'octet négatif ni de compte négatif.

### 4.3 Contre-épreuve de calcul

Deux volets.

1. **L'erreur classique.** Un calcul délibérément faux retire deux adresses y
   compris en /31. Le test exige qu'il **diffère** du calcul juste — 0 contre
   2 — et un **contrôle positif** montre que la même erreur est **invisible en
   /24**, ce qui explique pourquoi le /31 est le cas qui doit figurer dans la
   liste d'essais.
2. **L'arithmétique signée.** Le test vérifie que `(0xFFFFFFFF << 8)` est bien
   **négatif** en JavaScript, et que la même valeur calculée en BigInt reste
   positive. Si les deux coïncidaient, le choix de BigInt serait sans objet.

### 4.4 Les dix contre-épreuves de sécurité

| # | Risque | Vérification | Résultat |
|---|---|---|---|
| 1 | Scan public | 5 plages publiques refusées, message nommant la cause | détecté |
| 2 | Scan trop large | /8, /12, /16, /23 refusés, plafond nommé | détecté |
| 3 | Mot de passe dans le script | `ConvertTo-SecureString`, `-AsPlainText`, `-Password`, `/user:` | détecté |
| 4 | Clé Wi-Fi affichée | `key=clear` | détecté |
| 5 | TLS ignoré | `SkipCertificateCheck`, `ServerCertificateValidationCallback` | détecté |
| 6 | Pare-feu désactivé | `Set-NetFirewallProfile -Enabled False` | détecté |
| 7 | Ping infini | `ping -t`, `while ($true)` | détecté |
| 8 | `-Confirm:$false` | motif | détecté |
| 9 | Route par défaut supprimée | `Remove-NetRoute … 0.0.0.0/0` | détecté |
| 10 | Script historique modifié | empreinte altérée contre la référence des 440 | détecté |

**Chaque motif est lui-même éprouvé sur un script fautif fabriqué** : un
contrôle qui ne trouve jamais rien ne doit pas passer pour un contrôle qui
valide.

Aucun des 23 scripts de la catégorie Réseau ne porte un seul de ces motifs,
dans aucun mode.

---

## 5. Sources Microsoft

| | |
|---|---|
| URL distinctes citées | **248** |
| Vérifiées en ligne, par code HTTP **et** par titre | **248 / 248** |
| Échecs | **0** |
| Contrôles exécutés | **993** |
| Liens morts trouvés et remplacés | **3** |

Les trois remplacements : `netsh/netsh-wlan`, la page de sous-réseaux de
Windows Server, et les paramètres TCP/IP — toutes trois en 404, remplacées par
des pages vérifiées.

**Le contrôle regarde le titre, pas seulement le code** : Microsoft Learn sert
certaines pages mortes avec un code 200. Les pages d'archive (identifiant en
guise de slug) et les pages renommées dans la même section sont acceptées, et
c'est documenté.

Aucune source non officielle n'est citée. IT-Tools et Infotec n'apparaissent
nulle part : les procédures reposent sur Microsoft Learn.

Détail : `LOT-5-SOURCES.json`.

---

## 6. Architecture

| Fichier | Nature |
|---|---|
| `dist/outils-reseau.mjs` | **créé** — 5 895 lignes, les 22 assistants |
| `dist/calcul-ip.mjs` | **créé** — arithmétique IPv4 en BigInt |
| `dist/validateurs.mjs` | étendu — +249 lignes, aucun doublon |
| `dist/generators.mjs` | **+2 lignes** — un `import`, une boucle |
| `test/scripts-baseline.json` | référence refigée sur 4c37ce2, 440 scripts, quatrième ancrage |
| `test/identity.test.mjs` | section LOT 5 et contre-épreuves |
| `test/generate-ps1.mjs` | valeurs Réseau pour les 8 jeux |
| `test/captures-lot5.mjs` | **créé** — production des preuves visuelles |
| `LOT-5-*.json`, `LOT-5-*.md`, `docs/captures-lot5/` | livrables |

Aucun autre fichier touché. Aucune dépendance ajoutée, aucun framework, aucun
bundler, aucun backend, aucune télémétrie, aucun CDN, aucun secret. `app.js`
n'est pas modifié : l'application continue à générer, afficher, copier et
télécharger, et ne prétend à aucun moment exécuter quoi que ce soit depuis
GitHub Pages.

---

## 7. Captures

Dans `docs/captures-lot5/` :

| Fichier | Ce qu’il montre |
|---|---|
| `01-accueil-bureau-clair.png` | accueil 1440 px, thème clair |
| `02-accueil-bureau-sombre.png` | même page, thème sombre |
| `03-recherche-reseau.png` | recherche « latence reseau » |
| `04-fiche-debutant.png` | fiche en mode Débutant |
| `05-fiche-technicien.png` | même fiche en mode Technicien |
| `06-validation-refusee.png` | `256.1.1.1` saisie — refus |
| `06b-validation-refusee-gros-plan.png` | le message de refus, lisible |
| `07-rapport-genere.png` | aperçu du rapport réseau complet |
| `08-mobile-390-accueil.png` | accueil à 390 px — **0 px de débordement** |
| `09-mobile-390-fiche.png` | fiche à 390 px — **0 px de débordement** |
| `10-mobile-390-sombre.png` | 390 px, thème sombre |
| `11-calculateur-resultat.png` | **le calcul `172.16.5.130/26`, comparaison et découpage en /28, tel qu’il apparaît dans l’aperçu — sans que rien ait été exécuté** |
| `12-calculateur-fiche.png` | fiche complète du calculateur |

---

## 8. Limites connues

1. **Aucune exécution sur une vraie machine Windows, un vrai réseau, un vrai
   domaine.** C'est la limite principale, et elle vaut pour les vingt-deux.
2. **Windows PowerShell 5.1 n'a pas été exécuté.** Seule la CI sur
   `windows-latest` peut le faire.
3. La gigue de `latency-packet-loss` est un **écart-type d'aller-retours**, pas
   la gigue au sens de la RFC 3550, qui se mesure sur un flux continu. Le mot
   « approximative » est dans le titre du résultat.
4. `ip-conflict-detection` ne conclut jamais : un conflit intermittent échappe
   à toute mesure ponctuelle, et la preuve se prend sur le commutateur.
5. La comparaison de `network-baseline` ignore délibérément les compteurs et
   les adresses IPv6 temporaires. Une adresse temporaire renouvelée apparaîtra
   comme apparue et disparue : c'est attendu, et dit dans la fiche.
6. Le calculateur couvre **IPv4 seulement**. L'IPv6 a une arithmétique
   différente, des préfixes jusqu'à /128 et pas d'adresse de diffusion : la
   traiter avec les mêmes formules donnerait des résultats faux.
7. `rpc-connectivity-test` éprouve un échantillon de la plage dynamique pour
   savoir si le chemin est ouvert. Il ne cherche pas ce qui écoute — ce serait
   un balayage — donc il ne peut pas dire qu'un service précis est joignable.
8. `wifi-vpn-diagnostic` ne reconnaît un client VPN tiers que par la
   description de son interface. Un client exotique peut lui échapper.

---

## 9. État de livraison

| | |
|---|---|
| Branche | `claude/lot-5-reseau-avance` |
| SHA de base | `4c37ce2` — LOT 4 corrigé |
| Commits | 1 (correctif LOT 4) + 9 (LOT 5) |
| Poussé ? | **Non.** `access denied by the git proxy: NGAMS237/KJEMO-IT-Toolkit is not in this session's authorized repository set` → HTTP 403. **Une seule tentative, aucun jeton demandé, aucune restriction contournée.** |
| GitHub Actions | **aucune exécution.** Rien n'a tourné : Actions n'est pas déclaré vert. |
| Fusion dans `main` | **aucune** |
| Déploiement | **aucun** |

### Appliquer les patches — commandes exactes (CMD Windows)

Dans cet ordre. Le second se pose sur le résultat du premier.

```cmd
cd /d C:\chemin\vers\KJEMO-IT-Toolkit
git fetch origin

REM 1. Le correctif du LOT 4, sur la branche LOT 4
git checkout claude/lot-4-gpo-avance
git am LOT-4-CORRECTIF-GPOBACKUP.patch
git push origin claude/lot-4-gpo-avance

REM 2. Le LOT 5, sur sa propre branche, depuis le LOT 4 corrige
git checkout -b claude/lot-5-reseau-avance
git am LOT-5-RESEAU-AVANCE.patch
git push origin claude/lot-5-reseau-avance
```

Les empreintes SHA-256 des deux patches figurent dans `SHA256SUMS-LOT5.txt`.
Les deux ont été appliqués avec `git am` dans un clone neuf, et le résultat
reproduit exactement l'arbre de la branche de travail.

---

## Verdict

**READY FOR CODEX REVIEW.**

Avec les réserves du §8, et celle-ci avant toutes les autres : **aucun de ces
vingt-deux assistants n'a jamais parlé à un vrai réseau.** Windows PowerShell
5.1 n'a pas été exécuté. Ces deux contrôles sont branchés et attendent une
machine.

Le mot « VALIDÉ » n'est pas employé, et ne doit pas l'être tant que ces deux
choses n'ont pas eu lieu.
