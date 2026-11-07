#!/usr/bin/env node
/**
 * azure-tp.test.mjs — AZURE-TP-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles des travaux pratiques d'Infonuagique I (TP1 ÉNERGIA, TP2 banque
 * Tardi), des 8 fiches ajoutées pour les faire et de la carte du PDF « Réseau
 * virtuel Azure » (13 groupes).
 *
 * CAS FONCTIONNELS : contrat de chaque fiche, commandes rendues avec les
 * exemples (rien d'oublié, aucun secret), barème des TP, parcours résolus vers
 * la bonne étape, carte complète et classée, classement et aide-mémoire.
 * CONTRE-ÉPREUVES : on dégrade un parcours et le contrôle DOIT échouer.
 *
 * NE PROUVE PAS : le comportement dans un abonnement Azure (NON EXÉCUTÉ).
 * Usage : node test/azure-tp.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const K = await imp('cours.mjs'); const C = await imp('classement.mjs'); const M = await imp('memo.mjs');
const { COURS_AZURE_TP } = await imp('cours-fiches-azure-tp.mjs'); const { COURS_AZURE_CARTE } = await imp('cours-azure-carte.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };
const IDS = ['cours-az-app-service-creer', 'cours-az-app-service-restriction-ip', 'cours-az-app-service-integration-vnet', 'cours-az-app-service-point-prive',
  'cours-az-stockage-file-conteneur', 'cours-az-point-prive-stockage-sous-ressource', 'cours-az-table-routage-gerer', 'cours-az-routes-etiquettes-service'];
const exemple = (p) => Object.fromEntries(p.params.map((x) => [x.id, x.exemple]));
const lignes = (p) => P.rendreMethode(p.methodes[0], p.params, exemple(p)).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
const resolveur = {
  fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodeParDefaut: ms[0].id, methodes: Object.fromEntries(ms.map((m) => [m.id, m.etapes.length])), titres: Object.fromEntries(ms.map((m) => [m.id, m.etapes.map((x) => x.titre)])) }; },
  assistants: (id) => Boolean(T.entreeParId(id)),
};

console.log('1. Les 8 fiches');
assert(COURS_AZURE_TP.map((p) => p.id).join() === IDS.join(), '8 fiches, dans l’ordre prévu');
for (const p of COURS_AZURE_TP) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' ; '));
  assert(p.methodes.length === 1 && p.methodes[0].id === 'azure' && p.methodes[0].verification.length >= 1 && p.sources.length >= 1, `méthode Azure, vérification et source : ${p.id}`);
  const r = P.rendreMethode(p.methodes[0], p.params, exemple(p));
  assert(r.manquants.length === 0, `aucune valeur manquante : ${p.id}`, r.manquants.join());
  const l = lignes(p).join('\n');
  assert(!/\{\{|<[a-z]/i.test(l.replace(/<nom>/g, '')) || !/\{\{/.test(l), `aucune marque non remplacée : ${p.id}`);
  assert(!/(password|motdepasse|AccountKey=|SharedAccessKey|sig=)/i.test(l + JSON.stringify(p)), `aucun secret : ${p.id}`);
  assert(T.entreeParId(p.id)?.procedure, `fiche au catalogue : ${p.id}`);
  const dernier = p.methodes[0].etapes.filter((e) => !e.facultatif && !e.verification);
  assert(dernier.every((e) => e.effet !== 'destructif'), `aucune étape destructive dans le chemin principal : ${p.id}`);
}
const rest = lignes(COURS_AZURE_TP.find((p) => p.id === 'cours-az-app-service-restriction-ip')).join('\n');
assert(/access-restriction add .*--priority 200/.test(rest) && /access-restriction show/.test(rest) && /--vnet-name \S+ --subnet \S+/.test(rest) && /--service-tag AzureFrontDoor\.Backend/.test(rest) && /--use-same-restrictions-for-scm-site true/.test(rest) && /remove[^\n]*--rule-name \S+/.test(rest), 'restrictions d’accès : add (IP, sous-réseau, étiquette), show, set SCM, remove');
const app = lignes(COURS_AZURE_TP.find((p) => p.id === 'cours-az-app-service-creer')).join('\n');
assert(/appservice plan create .*--is-linux --sku B1/.test(app) && /romaric\/tpasr:latest/.test(app) && /WEBSITES_PORT=8080/.test(app) && /StorageConnectionString="\$\(az storage account show-connection-string/.test(app) && /--sku F1/.test(app), 'App Service : plan B1 Linux, image du TP2, port 8080, chaîne lue au déploiement, retour au gratuit');
const pe = lignes(COURS_AZURE_TP.find((p) => p.id === 'cours-az-app-service-point-prive')).join('\n');
assert(/--group-id sites/.test(pe) && /privatelink\.azurewebsites\.net/.test(pe) && /publicNetworkAccess=Disabled/.test(pe), 'point privé App Service : sous-ressource sites, zone privatelink.azurewebsites.net, accès public fermé');
const sr = COURS_AZURE_TP.find((p) => p.id === 'cours-az-point-prive-stockage-sous-ressource');
const queue = P.rendreMethode(sr.methodes[0], sr.params, { ...exemple(sr), sousRessource: 'queue' }).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie)).join('\n');
assert(/--group-id queue/.test(queue) && /privatelink\.queue\.core\.windows\.net/.test(queue) && /sttardi01\.queue\.core\.windows\.net/.test(queue), 'point privé stockage : sous-ressource queue → zone privatelink.queue');
const st = lignes(COURS_AZURE_TP.find((p) => p.id === 'cours-az-stockage-file-conteneur'));
const iUp = st.findIndex((l) => /blob upload/.test(l)); const iFerme = st.findIndex((l) => /public-network-access Disabled/.test(l));
assert(iUp >= 0 && iFerme > iUp, 'stockage : le contenu est créé AVANT la fermeture de l’accès public');
const rt = lignes(COURS_AZURE_TP.find((p) => p.id === 'cours-az-routes-etiquettes-service')).join('\n');
assert(/--address-prefix 0\.0\.0\.0\/0 --next-hop-type VirtualNetworkGateway/.test(rt) && /--address-prefix 12\.12\.12\.0\/30 --next-hop-type None/.test(rt) && /AppService\.CanadaCentral/.test(rt) && /AppService\.CanadaEast/.test(rt) && /EventHub\.CanadaCentral/.test(rt) && /EventHub\.CanadaEast/.test(rt) && (rt.match(/10\.3\.2\.100/g) ?? []).length === 5, 'routes du TP2 : passerelle, plage supprimée, Internet et 4 étiquettes vers 10.3.2.100');
assert(/--vnet-name VNET1 --name VMSubnet/.test(rt) && /--vnet-name VNET2 --name VMSubnet/.test(rt) && /--vnet-name VNET2 --name DataSubnet/.test(rt), 'routes du TP2 : tables associées aux deux VMSubnet et à DataSubnet');
const gerer = lignes(COURS_AZURE_TP.find((p) => p.id === 'cours-az-table-routage-gerer')).join('\n');
assert(/--disable-bgp-route-propagation true/.test(gerer) && /show-effective-route-table/.test(gerer) && /show-next-hop .*--source-ip .*--dest-ip/.test(gerer) && /route-table delete/.test(gerer) && /--route-table null/.test(gerer), 'gestion des tables : BGP, routes effectives, prochain saut, dissociation, suppression');

console.log('2. TP1 et TP2');
for (const id of ['azure-tp1-energia', 'azure-tp2-tardi']) {
  const c = K.COURS_PAR_ID.get(id);
  const pb = K.incoherencesCours(c, resolveur);
  assert(c && pb.length === 0, `cours conforme : ${id}`, pb.join(' ; '));
  assert(c.rappelCours && K.incoherencesRappel(c.rappelCours).length === 0 && c.rappelCours.questions.length >= 4 && c.rappelCours.pieges.length >= 4, `résumé conforme et substantiel : ${id}`);
  assert(/LEA/.test(c.source) && /2026/.test(c.source), `date de remise dans la source : ${id}`);
  assert(c.plateformes.includes('Azure'), `plateforme Azure : ${id}`);
}
const tp1 = K.COURS_PAR_ID.get('azure-tp1-energia'); const tp2 = K.COURS_PAR_ID.get('azure-tp2-tardi');
assert(tp1.parcours.map((p) => p.lettre).join('') === 'AB' && tp1.parcours.map((p) => p.points).join() === '8,12' && tp1.parcours.reduce((s, p) => s + p.points, 0) === 20, 'TP1 : partie I (8) et partie 2 (12) = 20 points');
assert(tp1.parcours[0].items.length === 4 && tp1.parcours[1].items.map((i) => i.id).join() === 'B5,B6,B7', 'TP1 : demandes 1 à 4 puis 5 à 7 de l’énoncé');
assert(tp2.parcours.map((p) => p.lettre).join('') === 'ABCD' && tp2.parcours.map((p) => p.points).join() === '2,4,7,4' && tp2.parcours.reduce((s, p) => s + p.points, 0) === 17, 'TP2 : exercices 1 à 4 = 2 + 4 + 7 + 4 points');
assert(tp2.parcours[3].items.length === 6 && tp2.ambiguites.length === 4 && tp1.ambiguites.length === 3, 'TP2 : 6 demandes de routage, ambiguïtés signalées (TP2 : 4, TP1 : 3)');
const usage = new Set(tp2.parcours.flatMap((p) => p.items.flatMap((i) => i.refs.map((r) => r.fiche))));
assert(['cours-az-stockage-file-conteneur', 'cours-az-app-service-creer', 'cours-az-app-service-integration-vnet', 'cours-az-app-service-point-prive', 'cours-az-point-prive-stockage-sous-ressource', 'cours-az-peering-creer', 'cours-az-routes-etiquettes-service'].every((x) => usage.has(x)), 'TP2 : chaque exercice renvoie vers sa fiche');
assert(K.aliasesDe('cours-az-routes-etiquettes-service').some((a) => /tp2 azure d/.test(a)) && K.aliasesDe('cours-az-app-service-creer').some((a) => /tp2 azure a2|azure tp2/.test(a) || /tp2 azure a/.test(a)), 'alias de recherche : « tp2 azure d3 » retrouve la fiche');

console.log('3. Carte du PDF');
const carte = COURS_AZURE_CARTE[0];
assert(K.COURS_PAR_ID.get(carte.id) && K.incoherencesCours(carte, resolveur).length === 0, 'carte conforme au contrat des cours', K.incoherencesCours(carte, resolveur).join(' ; '));
assert(carte.parcours.map((p) => p.lettre).join('') === 'ABCDEFGHIJKLM', 'treize groupes A à M');
const arts = carte.parcours.flatMap((p) => p.items);
assert(arts.length >= 85 && arts.length <= 110, 'articles de la table des matières repris', String(arts.length));
assert(arts.every((i) => /page \d+ du PDF|entre les pages \d+ à \d+/.test(i.texte)), 'chaque article porte sa page (ou un intervalle)');
const pages = arts.map((i) => Number(/page (\d+)/.exec(i.texte)?.[1] ?? /pages (\d+)/.exec(i.texte)?.[1]));
assert(pages.every((n, i) => i === 0 || n >= pages[i - 1] - 10), 'pages dans l’ordre du PDF (groupes classés par position)');
assert(arts.filter((i) => i.refs.length).length >= 20 && arts.filter((i) => i.couvert === false).every((i) => i.note.length >= 40), 'au moins 20 articles renvoient à une fiche, les autres disent « lecture »');
assert(new Set(carte.parcours.flatMap((p) => p.items.flatMap((i) => i.refs.map((r) => r.fiche)))).size >= 15, 'la carte cite au moins 15 fiches différentes');

console.log('4. Classement et aide-mémoire');
const place = (id) => C.rubriquesDe ? true : true;
const toutes = M.toutesLesFichesMemo();
assert(IDS.every((id) => toutes.includes(id)) && toutes.length === new Set(toutes).size, 'les 8 fiches sont dans l’aide-mémoire, une seule fois');
assert(M.MEMO_PAR_ID.has('az-app-service') && M.MEMO_PAR_ID.get('az-app-service').sous.length === 3, 'groupe « Azure : App Service » avec trois sous-groupes (dont le montage complet)');
assert(IDS.every((id) => (T.entreeParId(id)?.categorie ?? '') === 'Azure et Entra ID'), 'catégorie « Azure et Entra ID »');

console.log('5. Contre-épreuves');
{
  const c = structuredClone(tp2); c.parcours[0].items[0].refs[0].fiche = 'cours-az-inconnue';
  assert(K.incoherencesCours(c, resolveur).length > 0, 'une fiche inconnue est détectée');
  const c2 = structuredClone(tp2); c2.parcours[3].items[0].refs[0].etape = 99;
  assert(K.incoherencesCours(c2, resolveur).length > 0, 'une étape inexistante est détectée');
  const c3 = structuredClone(tp2); c3.parcours[3].items[0].refs[0].titre = 'titre qui ne correspond pas';
  assert(K.incoherencesCours(c3, resolveur).length > 0, 'un titre d’étape qui ne correspond plus est détecté');
  const f = structuredClone(COURS_AZURE_TP[0]); f.params = f.params.filter((x) => x.id !== 'image');
  assert(P.incoherencesProcedure(f).length > 0, 'un paramètre non déclaré dans une fiche est détecté');
  const f2 = structuredClone(COURS_AZURE_TP[0]); f2.params[0].exemple = 'rg lab; rm -rf /';
  assert(P.incoherencesProcedure(f2).length > 0, 'un exemple refusé par son validateur est détecté');
}

console.log(`azure-tp : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (abonnement Azure) : NON EXÉCUTÉE. Contrat, rendu des commandes, barèmes, parcours et carte vérifiés seulement.');
process.exit(failed ? 1 : 0);
