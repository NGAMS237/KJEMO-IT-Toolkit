#!/usr/bin/env node
/**
 * azure-cours.test.mjs — KJEMO-AZURE-COURS-01 · KJEMO IT Toolkit
 * -------------------------------------------------------------------
 * Contrôles des cours d'infonuagique (Azure) : 19 fiches Azure CLI, 5 cours et
 * leurs parcours, 5 résumés pliables, 10 schémas originaux (SVG), absence de
 * doublons avec le catalogue existant, classement et aide-mémoire.
 *
 * CAS FONCTIONNELS : contrat de chaque fiche, commandes rendues avec les valeurs
 * d'exemple (aucune marque non remplacée, aucun secret, jamais de suppression
 * dans le chemin principal), nouveaux validateurs (nom Azure, compte de
 * stockage), plan d'adressage recalculé (adresses réservées, chevauchements),
 * parcours résolus, résumés complets, schémas valides.
 * CONTRE-ÉPREUVES : on dégrade un cours, un résumé, une fiche, un paramètre, et
 * le contrôle DOIT échouer.
 * SÉCURITÉ / DROIT D'AUTEUR : aucun schéma ne contient d'image embarquée, de lien
 * ni de script ; aucune commande n'est exécutée ; aucun mot de passe ni clé dans
 * une fiche.
 *
 * NE PROUVE PAS : le comportement dans un abonnement Azure (NON EXÉCUTÉ), ni
 * l'exactitude d'un affichage dans un navigateur donné.
 * Usage : node test/azure-cours.test.mjs   (exit 0 = tout OK)
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (f) => import(pathToFileURL(resolve(ROOT, 'dist', f)).href);
const T = await imp('taches.mjs'); const C = await imp('classement.mjs'); const P = await imp('procedures.mjs');
const K = await imp('cours.mjs'); const M = await imp('memo.mjs'); const S = await imp('schemas-cisco.mjs');
const R = await imp('cours-resume-azure.mjs'); const { COURS_AZURE } = await imp('cours-fiches-azure.mjs');
const { COURS_AZURE_PARCOURS } = await imp('cours-azure.mjs'); const { SCHEMAS_AZURE } = await imp('schemas-azure.mjs');
const VC = await imp('vue-cours.mjs'); const VT = await imp('vue-taches.mjs');
let passed = 0; let failed = 0;
const assert = (c, l, d = '') => { if (c) passed++; else { failed++; console.error(`  [FAIL]  ${l}${d ? ' — ' + d : ''}`); } };

const IDS = ['cours-az-groupe-ressources', 'cours-az-verrou-ressource', 'cours-az-role-coequipier',
  'cours-az-vnet-creer', 'cours-az-sous-reseau-ajouter', 'cours-az-plan-adressage', 'cours-az-ip-publique-privee', 'cours-az-vm-creer-vnet',
  'cours-az-dns-zone-publique', 'cours-az-dns-enregistrement-a', 'cours-az-dns-zone-privee',
  'cours-az-peering-creer', 'cours-az-peering-verifier', 'cours-az-routes-effectives', 'cours-az-route-personnalisee',
  'cours-az-point-service-stockage', 'cours-az-point-prive-stockage', 'cours-az-lb-creer', 'cours-az-lb-etat'];
const COURS_IDS = ['azure-01-02-infonuagique-azure', 'azure-03-reseau-virtuel', 'azure-04-resolution-noms', 'azure-05-peering-routage', 'azure-06-07-acces-prive-equilibrage'];
const SCHEMAS_NEUFS = Object.keys(SCHEMAS_AZURE);
const exemple = (p) => Object.fromEntries(p.params.map((x) => [x.id, x.exemple]));
const rendu = (id, saisies = null) => { const p = T.entreeParId(id).procedure; return P.rendreMethode(p.methodes[0], p.params, saisies ?? exemple(p)); };
const lignes = (id, saisies = null) => rendu(id, saisies).etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));

// ---------------------------------------------------------------------------
console.log('1. Les 19 fiches Azure CLI');
assert(COURS_AZURE.length === 19 && COURS_AZURE.map((p) => p.id).join() === IDS.join(), '19 fiches, dans l’ordre prévu', String(COURS_AZURE.length));
for (const p of COURS_AZURE) {
  const pb = P.incoherencesProcedure(p);
  assert(pb.length === 0, `contrat : ${p.id}`, pb.join(' ; '));
  assert(p.origine === 'cours' && p.id.startsWith('cours-az-'), `origine cours : ${p.id}`);
  assert(p.methodes.length === 1 && p.methodes[0].id === 'azure', `méthode Azure unique : ${p.id}`);
  const e = T.entreeParId(p.id);
  assert(e && e.procedure === p, `dans le catalogue : ${p.id}`);
  assert(e && e.plateformes.join() === 'Azure', `plateforme Azure seule : ${p.id}`, e?.plateformes?.join());
  assert(C.cheminDe(e)?.domaineId === 'azure-entra', `rangée sous Azure et Entra ID : ${p.id}`, JSON.stringify(C.cheminDe(e)));
  assert(M.groupeDeFiche(p.id) !== null, `dans l’aide-mémoire : ${p.id}`);
  assert(p.figures === undefined || p.figures.every((f) => S.IDS_SCHEMAS.includes(f)), `schémas connus : ${p.id}`);
  assert(p.resume.length >= 20 && p.resume.length <= 400 && p.titre.length <= 70, `titre et résumé bornés : ${p.id}`, `${p.titre.length}/${p.resume.length}`);
  assert(p.methodes[0].verification.length >= 1 && (p.sources ?? []).length >= 1, `vérification et source : ${p.id}`);
  assert(p.methodes[0].etapes.every((x) => x.lignes.every((l) => !l.secret)), `aucune ligne à secret : ${p.id}`);
  if (p.effet === 'lecture') assert(p.methodes[0].etapes.every((x) => (x.effet ?? 'lecture') === 'lecture'), `fiche en lecture seule : toutes ses étapes le sont : ${p.id}`);
}
assert(new Set(IDS).size === IDS.length, 'identifiants uniques');

// ---------------------------------------------------------------------------
console.log('2. Commandes rendues avec les valeurs d’exemple');
for (const p of COURS_AZURE) {
  const r = rendu(p.id);
  assert(r.manquants.length === 0, `aucune valeur manquante : ${p.id}`, r.manquants.join());
  const toutes = r.etapes.flatMap((e) => (e.rendu?.lignes ?? []).map((l) => l.copie));
  assert(toutes.length >= 2, `commandes présentes : ${p.id}`);
  for (const l of toutes) {
    assert(!/\{\{|\}\}/.test(l) && !/‹|›/.test(l), `aucune marque non remplacée : ${p.id}`, l);
    assert(/^(az |nslookup )/.test(l), `commande az (ou nslookup de contrôle) : ${p.id}`, l);
    assert(!/\b(delete|--yes|purge|--force|--no-wait)\b/.test(l), `aucune suppression ni confirmation forcée dans une fiche : ${p.id}`, l);
    assert(!/(password|passwd|secret|--admin-password|--secrets|sas-token|account-key)/i.test(l), `aucun mot de passe, clé ni jeton dans une commande : ${p.id}`, l);
  }
}
{
  const g = lignes('cours-az-groupe-ressources');
  assert(g.includes('az group create --name rg-lab --location canadacentral'), 'groupe : az group create avec nom et région', g.join(' | '));
  const v = lignes('cours-az-vnet-creer');
  assert(v.includes('az network vnet create --resource-group rg-lab --name vnet1 --location canadacentral --address-prefixes 10.1.0.0/16 --subnet-name default --subnet-prefixes 10.1.0.0/24'), 'VNet : espace 10.1.0.0/16 et sous-réseau default 10.1.0.0/24 (démonstration du cours)', v.join(' | '));
  const pe = lignes('cours-az-peering-creer');
  assert(pe.includes('az network vnet peering create --resource-group rg-lab --name vnet1-vers-vnet2 --vnet-name vnet1 --remote-vnet vnet2 --allow-vnet-access')
    && pe.includes('az network vnet peering create --resource-group rg-lab --name vnet2-vers-vnet1 --vnet-name vnet2 --remote-vnet vnet1 --allow-vnet-access'), 'peering : les DEUX sens sont créés', pe.join(' | '));
  const lb = lignes('cours-az-lb-creer');
  const iCree = lb.findIndex((l) => l.startsWith('az network lb create')); const iSonde = lb.findIndex((l) => l.startsWith('az network lb probe create'));
  const iRegle = lb.findIndex((l) => l.startsWith('az network lb rule create')); const iPool = lb.findIndex((l) => l.includes('address-pool add'));
  assert(iCree >= 0 && iCree < iSonde && iSonde < iRegle && iRegle < iPool, 'Load Balancer : équilibreur, puis sonde, puis règle, puis ajout au pool', lb.join(' | '));
  assert(lb.some((l) => l.includes('--probe-name sonde-tcp') && l.startsWith('az network lb rule create')), 'la règle cite la sonde');
  const pp = lignes('cours-az-point-prive-stockage');
  assert(pp.some((l) => l.includes('--private-connection-resource-id /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-lab/providers/Microsoft.Storage/storageAccounts/stlab01') && l.includes('--group-id blob')), 'point privé : identifiant du compte reconstruit à partir des paramètres', pp.join(' | '));
  assert(pp.some((l) => l.includes('privatelink.blob.core.windows.net')) && pp.some((l) => l.startsWith('nslookup stlab01.blob.core.windows.net')), 'point privé : zone privatelink et contrôle nslookup');
  const ps = lignes('cours-az-point-service-stockage');
  const iAut = ps.findIndex((l) => l.includes('--ip-address')); const iDeny = ps.findIndex((l) => l.includes('--default-action Deny'));
  assert(iAut >= 0 && iAut < iDeny, 'point de service : ton adresse est autorisée AVANT la fermeture de l’accès public (garde-fou)', ps.join(' | '));
  const ro = lignes('cours-az-route-personnalisee');
  assert(ro.findIndex((l) => l.startsWith('az network route-table route create')) < ro.findIndex((l) => l.includes('--route-table rt-lab') && l.includes('subnet update')), 'route personnalisée : la route est créée AVANT l’association au sous-réseau');
  const vm = lignes('cours-az-vm-creer-vnet');
  assert(vm.some((l) => l.includes('--generate-ssh-keys') && l.includes('--nsg-rule NONE') && !/password/i.test(l)), 'machine : clé SSH générée, aucun mot de passe, aucun accès entrant', vm.join(' | '));
  const ro2 = T.entreeParId('cours-az-route-personnalisee').procedure.methodes[0].etapes;
  assert(ro2.find((x) => x.titre.startsWith('Associer'))?.effet === 'interruption' && T.entreeParId('cours-az-route-personnalisee').procedure.effet === 'interruption', 'l’association d’une table de routage est signalée comme interruption possible');
  assert(T.entreeParId('cours-az-point-service-stockage').procedure.methodes[0].etapes.some((x) => x.effet === 'interruption'), 'la fermeture de l’accès public est signalée comme interruption possible');
  assert(['cours-az-plan-adressage', 'cours-az-peering-verifier', 'cours-az-routes-effectives', 'cours-az-lb-etat'].every((id) => T.entreeParId(id).procedure.effet === 'lecture'), 'quatre fiches en lecture seule');
}

// ---------------------------------------------------------------------------
console.log('3. Nouveaux validateurs : cas valides et REFUS');
{
  const nom = (v) => P.TYPES_PARAM.nomAzure(v, { label: 'nom' });
  for (const bon of ['rg-lab', 'vnet1', 'a', 'GatewaySubnet', 'vm1VMNic', 'nom_avec.point', 'x'.repeat(64)]) assert(nom(bon).ok, `nomAzure : accepte « ${bon.slice(0, 16)} »`);
  for (const mauvais of ['', 'bad-', '-x', 'a b', 'a;b', 'a$(x)', 'x'.repeat(65), 'a/b', 'é', 'a.']) assert(!nom(mauvais).ok, `nomAzure : refuse « ${mauvais.slice(0, 16)} »`);
  const st = (v) => P.TYPES_PARAM.compteStockage(v, { label: 'compte' });
  for (const bon of ['stlab01', 'abc', 'a'.repeat(24)]) assert(st(bon).ok, `compteStockage : accepte « ${bon.slice(0, 12)} »`);
  for (const mauvais of ['', 'ab', 'Stlab', 'st-lab', 'a'.repeat(25), 'st_lab', 'st lab', 'st.lab']) assert(!st(mauvais).ok, `compteStockage : refuse « ${mauvais.slice(0, 12)} »`);
  const vn = T.entreeParId('cours-az-vnet-creer').procedure;
  assert(Boolean(P.evaluerValeurs(vn.params, { ...exemple(vn), espace: '10.1.0.0' }).erreurs.espace), 'espace d’adressage : un réseau sans préfixe est refusé');
  assert(Boolean(P.evaluerValeurs(vn.params, { ...exemple(vn), region: 'mars' }).erreurs.region), 'région : une valeur hors liste est refusée');
  assert(Boolean(P.evaluerValeurs(vn.params, { ...exemple(vn), groupe: 'rg; az group delete' }).erreurs.groupe), 'groupe : une injection de commande est refusée');
  const dn = T.entreeParId('cours-az-dns-zone-publique').procedure;
  assert(Boolean(P.evaluerValeurs(dn.params, { ...exemple(dn), zone: 'contoso' }).erreurs.zone) || Boolean(P.evaluerValeurs(dn.params, { ...exemple(dn), zone: 'a b.com' }).erreurs.zone), 'zone DNS : un nom invalide est refusé');
  const lk = T.entreeParId('cours-az-verrou-ressource').procedure;
  assert(Boolean(P.evaluerValeurs(lk.params, { ...exemple(lk), typeVerrou: 'Aucun' }).erreurs.typeVerrou), 'verrou : type hors liste refusé');
  const rl = T.entreeParId('cours-az-role-coequipier').procedure;
  assert(Boolean(P.evaluerValeurs(rl.params, { ...exemple(rl), role: 'Owner' }).erreurs.role), 'rôle : Owner n’est pas proposé (Lecteur ou Contributeur seulement)');
  assert(Boolean(P.evaluerValeurs(rl.params, { ...exemple(rl), utilisateur: 'a b@x.ca' }).erreurs.utilisateur), 'compte : une adresse avec espace est refusée');
  const sp = T.entreeParId('cours-az-point-service-stockage').procedure;
  assert(Boolean(P.evaluerValeurs(sp.params, { ...exemple(sp), compte: 'ST-LAB' }).erreurs.compte), 'compte de stockage : majuscules et tiret refusés');
  const lbp = T.entreeParId('cours-az-lb-creer').procedure;
  assert(Boolean(P.evaluerValeurs(lbp.params, { ...exemple(lbp), port: '99999' }).erreurs.port), 'port : 99999 refusé');
}

// ---------------------------------------------------------------------------
console.log('4. Exactitude des données du cours (recalculées)');
{
  // Adresses réservées d'un sous-réseau : on recalcule à partir du CIDR
  const ip = (s) => s.split('.').reduce((a, b) => a * 256 + Number(b), 0);
  const hotes = (pf) => 2 ** (32 - pf) - 5;
  assert(hotes(29) === 3 && hotes(24) === 251 && hotes(27) === 27, 'sous-réseau : 5 adresses réservées (un /29 offre 3 adresses, un /24 en offre 251)');
  const contient = (parent, enfant) => { const [a, p] = parent.split('/'); const [b, q] = enfant.split('/'); const m = p === '0' ? 0 : (0xFFFFFFFF << (32 - Number(p))) >>> 0; return Number(q) >= Number(p) && ((ip(a) & m) >>> 0) === ((ip(b) & m) >>> 0); };
  const chevauche = (x, y) => contient(x, y) || contient(y, x);
  const vn = T.entreeParId('cours-az-vnet-creer').procedure; const ex = exemple(vn);
  assert(contient(ex.espace, ex.plage), 'exemple VNet : le sous-réseau tient dans l’espace d’adressage', `${ex.plage} dans ${ex.espace}`);
  const sr = exemple(T.entreeParId('cours-az-sous-reseau-ajouter').procedure);
  assert(contient(ex.espace, sr.plage) && !chevauche(ex.plage, sr.plage), 'exemple sous-réseau : dans le VNet et sans chevauchement avec le premier', `${sr.plage}`);
  const rp = exemple(T.entreeParId('cours-az-route-personnalisee').procedure);
  assert(contient(ex.espace, rp.prefixe) && contient(`${rp.saut}/32`, `${rp.saut}/32`) && contient('10.1.0.0/16', `${rp.saut}/32`), 'exemple route : le préfixe et l’appliance sont dans le VNet', `${rp.prefixe} ${rp.saut}`);
  assert(!chevauche('10.1.0.0/16', '10.2.0.0/16') && chevauche('10.1.0.0/16', '10.1.5.0/24'), 'contrôle de chevauchement recalculé : 10.1/16 et 10.2/16 sont distincts, 10.1/16 contient 10.1.5/24');
  // plages de documentation (RFC 5737) pour les adresses publiques fictives
  for (const [id, cle] of [['cours-az-dns-enregistrement-a', 'adresse'], ['cours-az-point-service-stockage', 'monIp']]) {
    const v = exemple(T.entreeParId(id).procedure)[cle];
    assert(/^(192\.0\.2|198\.51\.100|203\.0\.113)\./.test(v), `adresse publique fictive réservée à la documentation : ${id}`, v);
  }
  for (const id of ['cours-az-ip-publique-privee', 'cours-az-route-personnalisee', 'cours-az-dns-zone-privee', 'cours-az-vm-creer-vnet']) {
    const e = exemple(T.entreeParId(id).procedure);
    for (const [k, v] of Object.entries(e)) if (/^\d+\.\d+\.\d+\.\d+$/.test(v) && ['ipPrivee', 'saut', 'adresse', 'ipCible'].includes(k)) assert(/^10\./.test(v) && !/\.(0|1|2|3|255)$/.test(v), `adresse privée d’exemple : jamais l’une des 5 réservées (${id}.${k})`, v);
  }
  // les 4 serveurs de noms Azure DNS, les routes système et les 4 composants de l'équilibreur figurent bien dans les résumés
  const t = JSON.stringify(R.RESUME_AZ_05) + JSON.stringify(R.RESUME_AZ_0607) + JSON.stringify(R.RESUME_AZ_03);
  for (const x of ['100.64.0.0/10', '172.16.0.0/12', '192.168.0.0/16', '168.63.129.16/32', '224.0.0.0/4', 'IP frontale', 'sondes d’intégrité', '15 minutes', '31 secondes']) assert(t.includes(x), `résumés : « ${x} » présent`);
  const sondes = JSON.stringify(R.RESUME_AZ_0607);
  assert(sondes.includes('15 secondes') && sondes.includes('code 200'), 'résumé Load Balancer : sonde toutes les 15 secondes et code 200');
}

// ---------------------------------------------------------------------------
console.log('5. Les cours et leurs parcours');
const resolveur = {
  fiches: (id) => { const e = T.entreeParId(id); if (!e?.procedure) return null; const ms = e.procedure.methodes; return { etapes: ms[0].etapes.length, methodeParDefaut: ms[0].id, methodes: Object.fromEntries(ms.map((m) => [m.id, m.etapes.length])), titres: Object.fromEntries(ms.map((m) => [m.id, m.etapes.map((x) => x.titre)])) }; },
  assistants: (id) => Boolean(T.entreeParId(id)),
};
assert(COURS_AZURE_PARCOURS.map((c) => c.id).join() === COURS_IDS.join(), '5 cours dans l’ordre du programme');
{
  const ordre = K.COURS.filter((c) => c.plateformes.includes('Azure')).map((c) => c.id);
  assert(ordre.join() === COURS_IDS.join(), '5 cours Azure au total', ordre.join());
}
for (const cid of COURS_IDS) {
  const c = K.COURS_PAR_ID.get(cid);
  assert(c && c.plateformes.join() === 'Azure', `cours Azure : ${cid}`);
  const pb = K.incoherencesCours(c, resolveur);
  assert(pb.length === 0, `le cours est conforme à son contrat : ${cid}`, pb.join(' ; '));
  assert(c.rappelCours && K.incoherencesRappel(c.rappelCours).length === 0, `résumé conforme : ${cid}`, K.incoherencesRappel(c.rappelCours ?? {}).join(' ; '));
  assert(K.lireRouteCours(`#/cours/${cid}/resume`)?.lettre === 'resume', `route /resume : ${cid}`);
  const items = c.parcours.flatMap((p) => p.items);
  assert(items.filter((i) => i.couvert === false).every((i) => i.note.length >= 40), `éléments non couverts expliqués : ${cid}`);
  assert(items.every((i) => i.couvert === false || i.refs.length || i.assistants?.length), `chaque élément couvert cite une fiche ou un assistant : ${cid}`);
  assert(items.some((i) => i.refs.length) && K.aliasesDe(items.find((i) => i.refs.length).refs[0].fiche).length > 0, `alias de recherche : ${cid}`);
  assert(c.avertissement.includes('facturées') && c.source.includes('non republiées'), `avertissement de facturation et source non republiée : ${cid}`);
}
{
  const citees = new Set(COURS_IDS.flatMap((cid) => { const c = K.COURS_PAR_ID.get(cid); return [...c.parcours.flatMap((p) => [...p.prerequis.map((r) => r.fiche), ...p.items.flatMap((i) => i.refs.map((r) => r.fiche))]), ...c.soutien.map((s) => s.fiche)]; }));
  assert(IDS.every((id) => citees.has(id)), 'chaque nouvelle fiche est atteinte par un parcours', IDS.filter((id) => !citees.has(id)).join());
  const assistants = new Set(COURS_IDS.flatMap((cid) => K.COURS_PAR_ID.get(cid).parcours.flatMap((p) => p.items.flatMap((i) => i.assistants ?? []))));
  assert(['azure-contexte', 'azure-rbac', 'azure-abonnements-rg', 'azure-reseau-vnets', 'azure-reseau-dns', 'azure-reseau-interfaces-ip', 'azure-stockage-exposition'].every((a) => assistants.has(a)), 'les assistants Azure existants sont CITÉS par les cours (jamais refaits)');
  assert(K.COURS_PAR_ID.get('azure-03-reseau-virtuel').ambiguites.length === 1 && K.COURS_PAR_ID.get('azure-06-07-acces-prive-equilibrage').ambiguites[0].texte.includes('DIFFÉRENTES'), 'ambiguïtés de l’énoncé signalées (Windows ou Linux ; service ou privé)');
}
// pas de doublon avec le catalogue existant
{
  const toutes = T.TOUTES_LES_ENTREES.filter((e) => e.procedure);
  const titres = new Map();
  for (const e of toutes) { const t = e.titre.toLowerCase(); titres.set(t, (titres.get(t) ?? 0) + 1); }
  assert(COURS_AZURE.every((p) => titres.get(p.titre.toLowerCase()) === 1), 'aucun titre de fiche en double dans le catalogue');
  const hotes = COURS_AZURE.map((p) => p.assistant).filter(Boolean);
  assert(new Set(hotes).size === hotes.length, 'chaque assistant existant n’est repris que par UNE fiche', hotes.join());
  assert(hotes.every((h) => T.entreeParId(h)?.kind === 'assistant'), 'les assistants repris existent bien', hotes.join());
  const existants = ['azure-contexte-courant', 'azure-changer-abonnement', 'azure-lister-groupes-ressources', 'azure-etat-machines-virtuelles'];
  assert(existants.every((id) => T.entreeParId(id) && !IDS.includes(id)), 'les fiches Azure existantes sont citées, jamais refaites');
  const cles = COURS_AZURE.flatMap((p) => p.intentions.map((i) => i.toLowerCase()));
  assert(new Set(cles).size === cles.length, 'aucune intention de recherche en double entre les nouvelles fiches');
  const autres = toutes.filter((e) => !IDS.includes(e.id)).flatMap((e) => e.procedure.intentions.map((i) => i.toLowerCase()));
  const communes = cles.filter((c) => autres.includes(c));
  assert(communes.length === 0, 'aucune intention de recherche déjà prise par une autre fiche', communes.join(' | '));
}
// contre-épreuves
{
  const c = structuredClone(K.COURS_PAR_ID.get('azure-05-peering-routage'));
  c.parcours[0].items[1].refs[0].etape = 99;
  assert(K.incoherencesCours(c, resolveur).length > 0, 'contre-épreuve : une étape inexistante est détectée');
  const c2 = structuredClone(K.COURS_PAR_ID.get('azure-03-reseau-virtuel'));
  c2.parcours[0].items[3].assistants = ['assistant-qui-n-existe-pas'];
  assert(K.incoherencesCours(c2, resolveur).length > 0, 'contre-épreuve : un assistant inconnu est détecté');
  const c3 = structuredClone(K.COURS_PAR_ID.get('azure-03-reseau-virtuel'));
  c3.parcours[0].items[4].refs = []; c3.parcours[0].items[4].assistants = [];
  assert(K.incoherencesCours(c3, resolveur).length > 0, 'contre-épreuve : un élément couvert sans fiche ni assistant est détecté');
  const c4 = structuredClone(K.COURS_PAR_ID.get('azure-04-resolution-noms'));
  c4.parcours[0].items[1].refs[0].titre = 'titre qui n’existe pas';
  assert(K.incoherencesCours(c4, resolveur).length > 0, 'contre-épreuve : un titre d’étape qui ne correspond plus est détecté');
  const r = structuredClone(R.RESUME_AZ_03); r.questions = r.questions.slice(0, 2);
  assert(K.incoherencesRappel(r).length > 0, 'contre-épreuve : trop peu de questions est détecté');
  const r2 = structuredClone(R.RESUME_AZ_05); r2.sections[0].schemas = ['schema-inconnu'];
  assert(K.incoherencesRappel(r2).length > 0, 'contre-épreuve : un schéma inconnu est détecté');
  const p = structuredClone(T.entreeParId('cours-az-vnet-creer').procedure);
  p.methodes[0].etapes[2].lignes[0].cmd = 'az network vnet create --name {{inconnu}}';
  assert(P.incoherencesProcedure(p).length > 0, 'contre-épreuve : un paramètre non déclaré dans une fiche est détecté');
  const p2 = structuredClone(T.entreeParId('cours-az-point-service-stockage').procedure);
  p2.params.find((x) => x.id === 'compte').exemple = 'ST-LAB';
  assert(P.incoherencesProcedure(p2).length > 0, 'contre-épreuve : un exemple refusé par son propre validateur est détecté');
  const p3 = structuredClone(T.entreeParId('cours-az-groupe-ressources').procedure);
  p3.params.push({ id: 'motDePasse', label: 'mot de passe', type: 'texte', exemple: 'x' });
  assert(P.incoherencesProcedure(p3).length > 0, 'contre-épreuve : un paramètre qui ressemble à un secret est refusé');
  const p4 = structuredClone(T.entreeParId('cours-az-lb-etat').procedure);
  p4.methodes[0].verification = [];
  assert(P.incoherencesProcedure(p4).length > 0, 'contre-épreuve : une méthode sans vérification finale est détectée');
}

// ---------------------------------------------------------------------------
console.log('6. Les résumés pliables');
for (const [nom, r, schemas] of [['01', R.RESUME_AZ_01, ['az-modeles-service', 'az-regions-zones', 'az-hierarchie']], ['03', R.RESUME_AZ_03, ['az-vnet-sous-reseaux']], ['04', R.RESUME_AZ_04, ['az-dns-public-prive']],
  ['05', R.RESUME_AZ_05, ['az-peering', 'az-routes-systeme']], ['06-07', R.RESUME_AZ_0607, ['az-service-prive', 'az-lb-choix', 'az-lb-composants']]]) {
  assert(K.incoherencesRappel(r).length === 0, `résumé conforme : ${nom}`, K.incoherencesRappel(r).join(' ; '));
  assert(r.sections.length >= 3 && r.essentiel.length >= 4 && r.commandes.length >= 5 && r.questions.length >= 4 && r.pieges.length >= 4, `résumé substantiel : ${nom}`);
  const utilises = new Set(r.sections.flatMap((s) => s.schemas ?? []));
  assert(schemas.every((s) => utilises.has(s)), `schémas attendus dans le résumé : ${nom}`, schemas.filter((s) => !utilises.has(s)).join());
}
{
  const ctx = { fiche: (id) => { const e = T.entreeParId(id); return e ? { titre: e.titre, etapes: e.procedure.methodes[0].etapes } : null; }, assistant: () => null };
  for (const cid of COURS_IDS) {
    const c = K.COURS_PAR_ID.get(cid);
    const html = VC.coursPageMarkup(c, 'A', {}, ctx);
    assert(/<details class="cours-resume" id="resume-cours">/.test(html) && !/id="resume-cours" open/.test(html), `résumé PLIÉ par défaut : ${cid}`);
    assert(VC.coursPageMarkup(c, 'resume', {}, ctx).includes('id="resume-cours" open'), `route /resume : déplié : ${cid}`);
    const n = c.rappelCours.sections.reduce((a, s) => a + (s.schemas ?? []).length, 0);
    assert((html.match(/class="schema"/g) ?? []).length >= n, `schémas du résumé affichés : ${cid}`, String((html.match(/class="schema"/g) ?? []).length));
    assert((html.match(/class="rappel-question"/g) ?? []).length === c.rappelCours.questions.length, `une question repliée par question : ${cid}`);
    assert(!/<script|onclick=|javascript:/i.test(html), `aucun script dans le marquage : ${cid}`);
  }
  const liste = VC.coursListeMarkup(K.COURS.filter((c) => c.plateformes.includes('Azure')), {}, ctx, 'Azure');
  assert(COURS_IDS.every((cid) => liste.includes(`${cid}/resume`)), 'chaque carte de cours Azure propose un lien direct vers le résumé');
}

// ---------------------------------------------------------------------------
console.log('7. Les 10 schémas originaux');
{
  assert(SCHEMAS_NEUFS.length === 10 && SCHEMAS_NEUFS.every((id) => S.IDS_SCHEMAS.includes(id)) && S.IDS_SCHEMAS.length === 50, '10 schémas ajoutés aux 40 existants (22 + 9 de la semaine 9 + 9 de NAT)', String(S.IDS_SCHEMAS.length));
  const tmp = mkdtempSync(resolve(tmpdir(), 'svg-'));
  for (const id of SCHEMAS_NEUFS) {
    const sc = S.SCHEMAS[id]; const svg = sc.svg();
    assert(svg.startsWith('<svg ') && svg.endsWith('</svg>'), `SVG complet : ${id}`);
    assert(/role="img"/.test(svg) && /<title id="[^"]+">[^<]{10,}<\/title>/.test(svg) && /<desc id="[^"]+">[^<]{30,}<\/desc>/.test(svg), `titre et description pour lecteur d’écran : ${id}`);
    assert(S.altSchema(id)?.length >= 30, `texte alternatif : ${id}`);
    assert(!/<image|data:|href=|<script|<foreignObject|onload=|xlink/i.test(svg), `aucune image embarquée, aucun lien, aucun script : ${id}`);
    assert(/viewBox="0 0 \d+ \d+"/.test(svg) && !/NaN|undefined/.test(svg), `viewBox et aucune valeur invalide : ${id}`);
    assert(sc.legende.length >= 40 && sc.titre.length >= 10, `légende et titre : ${id}`);
    assert(S.figureMarkup(id).includes('<figcaption>'), `figure + légende : ${id}`);
    assert(new Set([...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])).size === [...svg.matchAll(/ id="([^"]+)"/g)].length, `identifiants internes uniques : ${id}`);
    const f = resolve(tmp, `${id}.svg`); writeFileSync(f, svg);
    try { execFileSync('xmllint', ['--noout', f], { stdio: 'pipe' }); assert(true, `XML bien formé : ${id}`); } catch (e) { assert(false, `XML bien formé : ${id}`, String(e.stderr ?? e.message).slice(0, 200)); }
  }
  // Jamais la couleur seule : les schémas d'état disent aussi l'état par un symbole ET un mot
  for (const id of ['az-peering', 'az-vnet-sous-reseaux', 'az-routes-systeme', 'az-service-prive', 'az-lb-composants', 'az-dns-public-prive', 'az-modeles-service', 'az-regions-zones']) assert(/[✓✗⚠⊘]/.test(S.SCHEMAS[id].svg()) || /✎/.test(S.SCHEMAS[id].svg()), `symbole en plus de la couleur : ${id}`);
  const vn = S.SCHEMAS['az-vnet-sous-reseaux'].svg();
  assert((vn.match(/⊘/g) ?? []).length === 5 && vn.includes('10.1.1.4 à .254'), 'schéma VNet : exactement 5 adresses réservées, les autres utilisables', String((vn.match(/⊘/g) ?? []).length));
  const rt = S.SCHEMAS['az-routes-systeme'].svg();
  assert(['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '0.0.0.0/0'].every((x) => rt.includes(x)) && (rt.match(/>Aucun</g) ?? []).length === 4, 'schéma des routes : les 4 blocs privés vers « Aucun » et 0.0.0.0/0 vers Internet');
  const lbc = S.SCHEMAS['az-lb-choix'].svg();
  assert(['Load Balancer', 'Application Gateway', 'Traffic Manager', 'Front Door'].every((x) => lbc.includes(x)), 'schéma de choix : les quatre services');
  const pe = S.SCHEMAS['az-peering'].svg();
  assert(pe.includes('Connected') && pe.includes('Initiated') && pe.includes('A ne joint pas C'), 'schéma du peering : Connected, Initiated et absence de transit');
}

// ---------------------------------------------------------------------------
console.log('8. Pages de fiche, classement et aide-mémoire');
{
  const e = T.entreeParId('cours-az-peering-creer');
  const html = VT.tachePageMarkup(e, { methodeId: 'azure', saisies: exemple(e.procedure) });
  assert(html.includes('id="schemas-fiche" open') && (html.match(/class="schema"/g) ?? []).length === e.procedure.figures.length, 'fiche peering : schémas dépliés');
  assert(html.includes('id="rappel-cours"') && !/id="rappel-cours" open/.test(html), 'fiche peering : rappel du cours PLIÉ');
  assert(html.includes('az network vnet peering create') && !/<script|onclick=|javascript:/i.test(html), 'fiche peering : commande visible, aucun script');
  const ids = C.noeud('azure-entra', 'peering-routage')?.famille;
  assert(ids && ['cours-az-peering-creer', 'cours-az-peering-verifier', 'cours-az-routes-effectives', 'cours-az-route-personnalisee', 'cours-az-point-prive-stockage'].every((id) => ids.fiches.includes(id)), 'famille « Peering, routage et accès privé » : 5 fiches');
  // Le point de terminaison de service suit son assistant hôte (azure-stockage-exposition) : rubrique « Stockage et protection ».
  assert(C.cheminDe(T.entreeParId('cours-az-point-service-stockage'))?.famille?.id === 'stockage', 'fiche point de service : rangée avec son assistant hôte (stockage)');
  assert(C.noeud('azure-entra', 'equilibrage')?.famille?.fiches?.join() === 'cours-az-lb-creer,cours-az-lb-etat', 'famille « Équilibrage de charge » : 2 fiches');
  assert(C.noeud('azure-entra', 'acces')?.famille?.fiches?.includes('cours-az-role-coequipier'), 'famille « Connexion, contexte et accès » : le rôle de coéquipier');
  const memoIds = ['az-base', 'az-reseau', 'az-routage-prive', 'az-equilibrage'];
  assert(memoIds.every((id) => M.MEMO_PAR_ID.has(id)), '4 groupes d’aide-mémoire Azure ajoutés');
  const rangees = memoIds.flatMap((id) => M.fichesDuGroupe(M.MEMO_PAR_ID.get(id)));
  assert(rangees.filter((id) => IDS.includes(id)).length === 19 && IDS.every((id) => rangees.includes(id)), 'les 19 fiches sont rangées une fois, dans les quatre groupes', String(rangees.length));
  assert(IDS.every((id) => M.AJOUTS[id]), 'badge « nouveau » : les 19 fiches ont une date d’ajout');
  const pbMemo = M.incoherencesMemo({ existe: (id) => Boolean(T.entreeParId(id)), fichesAttendues: IDS });
  assert(pbMemo.length === 0, 'aide-mémoire cohérent', pbMemo.join(' | '));
  const lies = M.fichesDuCours(K.COURS_PAR_ID.get('azure-05-peering-routage'));
  assert(['cours-az-peering-creer', 'cours-az-route-personnalisee', 'cours-az-routes-effectives'].every((id) => lies.has(id)), 'filtre « Liés au TP » : le cours de peering retrouve ses fiches');
  for (const id of IDS.filter((x) => !COURS_AZURE.find((p) => p.id === x).assistant)) assert(C.estPlaceDirect(id), `placée directement : ${id}`);
  const filtre = M.MEMO_GROUPES.filter((g) => M.compteGroupe(g, { plat: 'Azure', plateformesDe: (id) => T.entreeParId(id)?.plateformes ?? [] }) > 0).map((g) => g.id);
  assert(memoIds.every((id) => filtre.includes(id)) && !filtre.some((id) => id.startsWith('win-') || id.startsWith('cisco-')), 'filtre Azure de l’aide-mémoire : les 4 groupes Azure, aucun groupe Windows ni Cisco', filtre.join());
}

// ---------------------------------------------------------------------------
console.log('9. Recherche');
{
  for (const [req, attendu] of [['groupe de ressources', 'cours-az-groupe-ressources'], ['verrou suppression', 'cours-az-verrou-ressource'], ['role contributeur coequipier', 'cours-az-role-coequipier'],
    ['creer vnet', 'cours-az-vnet-creer'], ['ajouter sous-reseau', 'cours-az-sous-reseau-ajouter'], ['ip publique statique', 'cours-az-ip-publique-privee'], ['creer vm dans vnet', 'cours-az-vm-creer-vnet'],
    ['zone dns azure', 'cours-az-dns-zone-publique'], ['enregistrement a cname azure', 'cours-az-dns-enregistrement-a'], ['zone dns privee', 'cours-az-dns-zone-privee'],
    ['peering vnet', 'cours-az-peering-creer'], ['routes effectives', 'cours-az-routes-effectives'], ['route personnalisee udr', 'cours-az-route-personnalisee'],
    ['service endpoint stockage', 'cours-az-point-service-stockage'], ['private endpoint stockage', 'cours-az-point-prive-stockage'], ['creer load balancer', 'cours-az-lb-creer'], ['sonde load balancer', 'cours-az-lb-etat']]) {
    const res = T.chercher(req, { plateforme: 'Azure' });
    const ids = (res.resultats ?? res).map((x) => x.entree?.id ?? x.id);
    assert(ids.slice(0, 5).includes(attendu), `recherche « ${req} » : ${attendu} parmi les 5 premiers`, ids.slice(0, 5).join());
  }
}

console.log(`\nazure-cours : ${passed} vérification(s) réussie(s), ${failed} échec(s).`);
console.log('Exécution réelle (abonnement Azure) : NON EXÉCUTÉE. Contrat, rendu des commandes, calculs, schémas et résumés vérifiés seulement.');
process.exit(failed ? 1 : 0);
