# Intégration Azure + Cisco — rapport

Branche `claude/integration-azure-cisco`. Parents de la fusion : LOT 8 `8633b46` (branche `claude/lot-8-azure-entra-id`) et RESEAU-CISCO-01 `5168d9e` (branche `claude/reseau-cisco-01`). Base commune `78a2c8b`. Les hachages du commit final et de son arbre sont dans `INTEGRATION-AZURE-CISCO-MANIFESTE.md` (un fichier ne peut pas contenir le hachage du commit qui le contient).

## État du dépôt distant vérifié avant d'intégrer
`git ls-remote` : `main` = `aff0f7a`, `reconciliation/lot7` = `78a2c8b`. Aucune branche distante n'est plus avancée que la base `78a2c8b` ; aucune branche `claude/lot-8-…` ni `claude/reseau-cisco-01` n'existe à distance (jamais poussées : accès en écriture refusé, 403). Il n'y avait donc aucun écart distant à examiner.

## Conflits résolus (12 fichiers) et choix
| Fichier | Nature | Résolution |
|---|---|---|
| `dist/categories.mjs` | deux catégories et deux listes de sous-rubriques ajoutées au même endroit | les deux conservées, dans l'ordre Azure puis Cisco ; 10 catégories canoniques |
| `dist/generators.mjs` | import et boucle d'enregistrement | `toolsAzure` ET `toolsCisco` |
| `dist/styles.css` | deux règles de débordement | `.cloud-bloc` ET `.cisco-bloc` + `.badge-cisco` |
| `dist/app.js` | `compatMarkup` et deux fonctions de bloc pédagogique | `cloudMarkup` ET `ciscoMarkup` appelés l'un après l'autre ; les deux fonctions conservées ; les branches IOS de Cisco (normalisation, notes, téléchargement sans BOM) intactes |
| `test/identity.test.mjs` | 6 zones | branche de privilèges Azure ET Cisco ; CANON à 10 ; visibles = 9 ; décompte `generate()`/sous-rubrique hors fabriques Azure ET Cisco ; boucle des récents (Cisco compté à part, Azure conservé) |
| `test/matrices-lot7.mjs` | filtre | exclut `Azure et Entra ID` ET `Réseau et Cisco` : 153 / 1 224 / 368 inchangés |
| `test/browser-identity.test.mjs`, `test/browser-lot7.test.mjs` | compte de catégories | 10 (« Tout » comprise), valeur mesurée et expliquée, pas supposée |
| `package.json`, `.github/workflows/validate-linux.yml` | scripts et étapes ajoutés des deux côtés | tous conservés, plus le banc d'intégration |
| `CHANGELOG.md`, `docs/FEUILLE-DE-ROUTE.md` | sections ajoutées en fin/tête | toutes conservées |

## Défauts trouvés par l'intégration et corrigés
1. **Lien `node_modules` suivi par Git** (checkpoint Cisco) : retiré du suivi (`git rm --cached`), `.gitignore` utilise `node_modules` sans barre finale (le motif `node_modules/` n'ignore PAS un lien symbolique) et `/node_modules`. Le lien reste dans l'**historique** des commits Cisco (aucune réécriture d'historique) ; l'arbre final n'en contient plus (`git ls-files | grep node_modules` = 0).
2. **Banc Cisco** : il figeait « 172 outils » ; le compte est désormais 153 + Azure (0 ou 24) + 19. Aucune assertion supprimée.
3. **Compteurs de catégories** figés à 9 dans `browser-lot7` et `browser-cisco` : 10 réel.
4. **Contre-épreuve LOT 7 M01** : sa cible textuelle (`const script = estBash(tool) ? …`) a disparu quand Cisco a factorisé `normaliserSortie`. Re-ciblée sur le site d'appel initial (`const script = normaliserSortie(tool, scriptBrut);` → `normalizeScript(scriptBrut)`), qui reproduit la **même panne** injectée et exige les **mêmes** étiquettes de détection (B5, B6, B7, F15). Une première re-cible sur le helper commun était trop large (F15 ne voyait plus la panne) : elle a été rejetée.
5. **Observation honnête** : lors d'une exécution **concurrente** d'un autre banc navigateur, les contre-épreuves LOT 7 ont affiché une fois « 56 OK, 1 ÉCHEC » ; rejouées seules, puis dans la suite séquentielle, elles donnent 57 OK, 0 échec (exit 0). Je n'ai pas isolé la cause (hypothèse : délais sous forte charge CPU) ; elle n'est pas écartée.
6. **Aucun état d'interface conservé par erreur** (voir le banc d'intégration) : pas de défaut trouvé de ce côté.

## Tests exécutés sur le commit de fusion + documentation (environnement : conteneur Linux, Node 22, Chromium 1194 via Playwright, PowerShell 7.4.6 Core)
Suite séquentielle, 29 étapes, toutes `exit=0` :
generate-ps1 ; baseline-856 (10 OK) ; check-ps1-bom (1 077 OK) ; **identity 84 802 OK, 0 échec** ; sh-hygiene (344 .sh + 1 072 .ps1) ; shquote ; sources-microsoft hors ligne (1 719 OK) ; scanner-bash ; commandes-rapides (112) ; dette-6b ; **matrices LOT 7 (153 / 1 224 / 368)** ; **matrices LOT 8 (24 outils, 192 scripts, 38 commandes)** ; **matrices Cisco (19 / 60 / 60)** ; sources-cisco (5 OK) ; ci-workflows (83 OK) ; cmdlets-export (177 = 153 + 24, Cisco exclu : sorties IOS) ; **banc Azure 3 277 OK** ; **banc Cisco 3 010 OK** ; contre-épreuves navigateur LOT 7 (16 pannes, 57 OK) ; négatifs LOT 7 ; fiches-poste-b (pwsh) ; poste-verrous ; jonction-domaine ; **navigateur : identité 7 955 OK, poste-b 418 OK, LOT 7 2 273 OK, Azure 810 OK, Cisco 1 028 OK, intégration 257 OK**.
Pass supplémentaire (non-sudo) : sauvegarde-bloquante, dns-change-bloquant, route-passerelle-bloquante, mouchards-linux, services-linux, reseau-linux, samba-ad-linux, samba-linux, cockpit-linux, capacites-linux, netplan-v2, négatifs LOT 7 contre-épreuves, sh-shellcheck.

Banc d'intégration `test/browser-integration.test.mjs` (nouveau) : 10 cartes dont « Tout », Imprimantes masquée ; recherche inter-catégories ; navigation **sans rechargement** dans les deux ordres (Azure→Cisco→Azure et Cisco→Azure→Cisco, trois paires chacun) en salissant la fiche quittée (valeurs saisies, copie) ; contrôle à chaque fiche de l'aperçu, des valeurs, du retour de copie, du bloc pédagogique, du bandeau, des notes d'exécution, du bouton, des sources et du téléchargement (.ps1 = BOM UTF-8 ; .ios.txt = ASCII, LF, sans BOM, sans « ? ») ; mobile 390 px. **Contre-épreuve** : une panne injectée dans `app.js` (retour de copie IOS identique à celui de PowerShell) a fait échouer le banc (6 échecs) ; `app.js` restauré octet pour octet.

## Non exécuté / limites
- Windows PowerShell 5.1 : **NON EXÉCUTÉ** (moteur absent de cet environnement). Le job Windows de la CI (`validate.yml`) le prévoit pour le banc Azure ; il n'a pas tourné.
- CI distante : **NON EXÉCUTÉE** (push refusé, 403). Aucune CI verte n'est annoncée.
- Essai sur un tenant/abonnement Azure réel, sur un équipement ou un simulateur Cisco : **NON EXÉCUTÉ** (doublures et analyse textuelle uniquement).
- Tests nécessitant `sudo`/mdadm/disques réels (stockage, quotas, raid, permissions, nfs, ssh) : non rejoués ici.
- Installation propre des dépendances : voir le manifeste (résultat de `npm ci` en clone neuf).
- La détection textuelle de secrets reste une heuristique, pas une garantie.
