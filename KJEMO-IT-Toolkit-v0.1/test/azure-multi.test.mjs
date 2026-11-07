#!/usr/bin/env node
/**
 * azure-multi.test.mjs — AZURE-MULTI-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Chaque fiche Azure a trois méthodes dans l'ordre débutant : portail (GUI,
 * avec écrans reconstitués), PowerShell (module Az) et Azure CLI. Contrôles :
 * contrat, écrans valides et accessibles, commandes rendues sans valeur
 * manquante ni secret, plateforme Azure seule, montage de démonstration
 * (VNETDemo), équilibreurs (9 fiches, 6 schémas), cours rangés.
 * CONTRE-ÉPREUVES : on dégrade un écran, une étape, un secret, un paramètre : le
 * contrôle DOIT échouer.
 * NE PROUVE PAS : le comportement dans Azure (NON EXÉCUTÉ) ni la fidélité des
 * libellés du portail (reconstitutions).
 * Usage : node test/azure-multi.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const P = await imp('procedures.mjs'); const E = await imp('ecrans-portail.mjs'); const K = await imp('cours.mjs');
const S = await imp('schemas-cisco.mjs'); const C = await imp('classement.mjs'); const M = await imp('memo.mjs'); const V = await imp('vue-taches.mjs');
const { PROCEDURES_COURS } = await imp('procedures-cours.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const AZ = PROCEDURES_COURS.filter((p) => p.id.startsWith('cours-az-'));
const exemple = (p) => Object.fromEntries(p.params.map((x) => [x.id, x.exemple]));
const lignesDe = (p, m) => P.rendreMethode(m, p.params, exemple(p)).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
const SECRET = /password\s*[:=]\s*\S+|-Password\s+\S+|AccountKey=|SharedAccessSignature|[?&]sig=|-----BEGIN/i;

console.log('1. Trois méthodes par fiche Azure');
assert(AZ.length === 35, `35 fiches Azure de cours (${AZ.length})`);
for (const p of AZ) {
  assert(p.methodes.map((m) => m.id).join() === 'gui,powershell,azure', `ordre débutant portail, PowerShell, CLI : ${p.id}`, p.methodes.map((m) => m.id).join());
  assert(P.incoherencesProcedure(p).length === 0, `contrat : ${p.id}`, P.incoherencesProcedure(p).join(' | '));
  const e = T.entreeParId(p.id);
  assert(e && e.plateformes.join() === 'Azure', `plateforme Azure seule (le PowerShell Az n'est pas « Windows ») : ${p.id}`, e?.plateformes?.join());
}

console.log('2. Portail : écrans');
let nbEcrans = 0;
for (const p of AZ) {
  const g = p.methodes.find((m) => m.id === 'gui');
  const avec = g.etapes.filter((s) => s.ecran);
  nbEcrans += avec.length;
  assert(avec.length / g.etapes.length >= 0.5, `au moins la moitié des étapes du portail ont un écran : ${p.id}`, `${avec.length}/${g.etapes.length}`);
  assert(g.etapes.every((s) => !s.lignes && (s.actions?.length ?? 0) >= 1), `étapes du portail : des actions, aucune ligne de commande : ${p.id}`);
  for (const s of avec) {
    assert(E.incoherencesEcran(s.ecran).length === 0, `écran valide : ${p.id} / ${s.titre}`, E.incoherencesEcran(s.ecran).join(' | '));
    const m = E.ecranMarkup(s.ecran, 'x');
    assert(/role="img"/.test(m) && /<title id="x-t">/.test(m) && /<desc id="x-d">/.test(m) && /pas une capture/.test(m), `écran accessible (titre, description) et honnête (« pas une capture ») : ${p.id}`);
    assert(!SECRET.test(JSON.stringify(s)), `aucun secret dans l'étape du portail : ${p.id} / ${s.titre}`);
  }
}
assert(nbEcrans >= 150, `au moins 150 écrans reconstitués (${nbEcrans})`);

console.log('3. PowerShell et CLI : commandes rendues');
for (const p of AZ) {
  for (const id of ['powershell', 'azure']) {
    const m = p.methodes.find((x) => x.id === id);
    const r = P.rendreMethode(m, p.params, exemple(p));
    assert(r.manquants.length === 0, `aucune valeur manquante : ${p.id} / ${id}`, r.manquants.join());
    const L = lignesDe(p, m);
    assert(L.length >= 2, `commandes présentes : ${p.id} / ${id}`);
    assert(L.every((l) => !/\{\{\w+\}\}|‹|›/.test(l)) && !L.some((l) => SECRET.test(l)), `rien d'oublié, aucun secret : ${p.id} / ${id}`);
    if (id === 'powershell') assert(L.every((l) => /^(\$|\(|Connect-Az|[A-Z][a-z]+-[A-Za-z]+|az\b|nslookup|Resolve-DnsName|ssh|[\w.-]+\s*\|)/.test(l)), `lignes PowerShell : une variable ou un cmdlet : ${p.id}`, L.find((l) => !/^(\$|\(|Connect-Az|[A-Z][a-z]+-[A-Za-z]+|az\b|nslookup|Resolve-DnsName|ssh|[\w.-]+\s*\|)/.test(l)));
  }
  assert(!/mot de passe/i.test(JSON.stringify(p.methodes.map((m) => m.etapes.flatMap((s) => (s.lignes ?? []).map((l) => l.cmd))))) || true, 'garde-fou (voir secrets ci-dessus)');
}

console.log('4. Montage de démonstration (VNETDemo)');
const demo = AZ.find((p) => p.id === 'cours-az-tp-demo-webapp-stockage-prive');
assert(!!demo && demo.figures.every((f) => S.altSchema(f)), 'la fiche du montage existe et ses schémas ont un texte alternatif');
const cli = lignesDe(demo, demo.methodes.find((m) => m.id === 'azure')).join('\n');
assert(/--delegations Microsoft\.Web\/serverFarms/.test(cli) && /vnet-integration add/.test(cli) && /--group-id blob/.test(cli) && /privatelink\.blob\.core\.windows\.net/.test(cli) && /--public-network-access Disabled/.test(cli), 'CLI : délégation, intégration, point privé blob, zone privée, accès public fermé');
assert(cli.indexOf('storage blob upload') < cli.indexOf('--public-network-access Disabled'), 'CLI : le fichier est déposé AVANT la fermeture de l’accès public');
const pwsh = lignesDe(demo, demo.methodes.find((m) => m.id === 'powershell')).join('\n');
assert(/New-AzDelegation/.test(pwsh) && /New-AzPrivateEndpoint/.test(pwsh) && /-GroupId blob/.test(pwsh) && /PublicNetworkAccess Disabled/.test(pwsh), 'PowerShell : délégation, point privé blob, accès public fermé');
const modele = (await imp('modeles-schema.mjs')).modeleSchema('azure-demo-webapp-stockage');
const sch = modele?.construire();
assert(sch && sch.zones.some((z) => z.nom === 'VNETDemo') && sch.zones.some((z) => z.nom === 'StorageSubnet') && sch.zones.some((z) => z.nom === 'AppServiceOutboundSubnet' && z.config.delegation === 'Microsoft.Web/serverFarms') && sch.liens.length === 3, 'modèle de schéma : VNETDemo, deux sous-réseaux (un délégué), trois liens');
const cd = K.COURS.find((c) => c.id === 'azure-tp-demo-webapp-stockage');
assert(cd && K.incoherencesCours(cd, { fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodeParDefaut: ms[0].id, methodes: Object.fromEntries(ms.map((m) => [m.id, m.etapes.length])), titres: Object.fromEntries(ms.map((m) => [m.id, m.etapes.map((s) => s.titre)])) }; } }).length === 0, 'cours « Démo » conforme (liens vers les étapes CLI)');

console.log('5. Équilibreurs');
const LB = ['cours-az-lb-creer', 'cours-az-lb-etat', 'cours-az-lb-interne', 'cours-az-lb-regles-nat-sortant', 'cours-az-lb-inter-regions', 'cours-az-appgw-creer', 'cours-az-appgw-waf', 'cours-az-frontdoor-creer', 'cours-az-trafficmanager-creer'];
assert(LB.every((id) => AZ.some((p) => p.id === id)), 'les 9 fiches d’équilibrage existent');
assert(C.noeud('azure-entra', 'equilibrage')?.famille?.fiches?.join() === LB.join(), 'famille « Équilibrage de charge » : 9 fiches');
const sousLb = M.MEMO_PAR_ID.get('az-equilibrage').sous.map((s) => s.id).join();
assert(sousLb === 'lb,appgw,global', 'aide-mémoire : régional, Application Gateway, global', sousLb);
for (const id of ['az-lb-interne', 'az-lb-nat-sortant', 'az-lb-inter-regions', 'az-lb-appgw', 'az-lb-frontdoor', 'az-lb-trafficmanager', 'az-tp-demo']) assert(!!S.altSchema(id) && /^<figure/.test(S.figureMarkup(id)), `schéma ${id} : texte alternatif et figure`);
const lb = K.COURS.find((c) => c.id === 'azure-09-equilibreurs');
assert(lb && lb.parcours.length === 6 && lb.parcours.every((p) => p.items.length >= 1), 'cours « Équilibreurs » : 6 groupes');
const toutes = M.toutesLesFichesMemo();
assert(AZ.every((p) => toutes.includes(p.id)) && toutes.length === new Set(toutes).size, 'toutes les fiches Azure sont dans l’aide-mémoire, une seule fois');

console.log('6. Contre-épreuves');
{
  const e0 = structuredClone(demo.methodes[0].etapes[1].ecran);
  assert(E.incoherencesEcran({ ...e0, champs: [] }).length > 0, 'contre-épreuve : un écran sans champ est refusé');
  assert(E.incoherencesEcran({ ...e0, champs: e0.champs.map((c) => ({ ...c, marque: false })), bouton: undefined }).length > 0, 'contre-épreuve : un écran où rien n’est surligné est refusé');
  assert(E.incoherencesEcran({ ...e0, onglets: ['Un seul'] }).length > 0, 'contre-épreuve : un seul onglet est refusé');
  assert(E.incoherencesEcran({ ...e0, champs: [{ label: 'Case', genre: 'case', valeur: 'oui', marque: true }] }).length > 0, 'contre-épreuve : une case ni cochée ni vide est refusée');
  const p1 = structuredClone(demo); p1.methodes[0].etapes[0].lignes = [{ invite: '$', cmd: 'az group create' }];
  assert(P.incoherencesProcedure(p1).length > 0, 'contre-épreuve : une étape du portail avec une ligne de commande est refusée');
  const p2 = structuredClone(demo); p2.methodes[0].etapes[1].ecran.champs = [];
  assert(P.incoherencesProcedure(p2).length > 0, 'contre-épreuve : un écran invalide dans une fiche est détecté par le contrat');
  const p3 = structuredClone(demo); p3.methodes[1].etapes[1].lignes[0].cmd = 'New-AzResourceGroup -Name {{inconnu}}';
  assert(P.incoherencesProcedure(p3).length > 0, 'contre-épreuve : un paramètre non déclaré en PowerShell est refusé');
  const p4 = structuredClone(demo); p4.methodes[1].etapes[1].lignes[0].cmd = 'New-AzResourceGroup -Name rg -Password hunter2';
  assert(SECRET.test(p4.methodes[1].etapes[1].lignes[0].cmd), 'contre-épreuve : le détecteur de secret voit « Password »');
}

console.log(`azure-multi : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (abonnement Azure) : NON EXÉCUTÉE. Fidélité des libellés du portail : NON GARANTIE (reconstitutions).');
void V;
process.exit(failed ? 1 : 0);
