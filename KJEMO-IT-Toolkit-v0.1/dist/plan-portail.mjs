/**
 * plan-portail.mjs — AZURE-LABO-PREPARATION-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Plan d'exécution DANS LE PORTAIL AZURE, généré depuis le schéma du labo :
 * pour préparer un travail (scolaire ou professionnel) entièrement dans le
 * labo, puis l'appliquer dans le portail en suivant le plan, sans rien
 * deviner. Pour chaque ressource, dans l'ordre de déploiement : le chemin dans
 * le portail, les valeurs à saisir onglet par onglet, les pièges connus et la
 * capture à garder (le compte doit y être visible).
 *
 * Module PUR (aucun DOM, aucun appel réseau, rien n'est exécuté). Les libellés
 * des écrans sont ceux d'un portail en français ; Microsoft les modifie : ce
 * sont des repères, pas des captures. Aucune valeur secrète n'est écrite : la
 * chaîne de connexion et les clés se copient dans le portail, au moment voulu.
 *
 * Retour : { blocs: [{ titre, lignes }], captures: [texte] }
 */
import { contexteAzure, normaliserConfigAzure, estAzure, typeAzure, nomAzure, cibleDuPe, vnetsConsommateurs,
  SOUS_RESSOURCES, ORDRE, REGIONS, TYPES_SAUT, DELEGATIONS, verifierAzure } from './config-azure.mjs';

const lieuRegion = (r) => REGIONS.find(([x]) => x === r)?.[1] ?? r;
const liste = (v) => String(v ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const saut = (id) => TYPES_SAUT.find(([x]) => x === id)?.[1] ?? id;
const COMPTE = 'ton compte doit être visible sur la capture';

/** Plan d'un schéma. */
export function planPortail(schema) {
  const ctx = contexteAzure(schema);
  const blocs = []; const captures = [];
  const bloc = (titre, lignes, capture = '') => {
    const L = lignes.filter(Boolean);
    if (capture) { L.push(`Capture à garder : ${capture} (${COMPTE}).`); captures.push(`${titre.replace(/^Portail : /, '')} → ${capture}`); }
    if (L.length) blocs.push({ titre: `Portail : ${titre}`.slice(0, 120), lignes: L });
  };
  const sn = (id) => ctx.sousReseaux.find((x) => x.id === id) ?? null;
  const nomSn = (s) => (s ? `${s.vnet?.nom ?? '?'} / ${s.nom}` : '?');

  // 1. Groupes de ressources
  const groupes = new Map();
  for (const v of ctx.vnets) groupes.set(v.groupe, v.region);
  for (const n of schema.noeuds) if (estAzure(n.type)) { const o = ctx.noeud(n); if (!groupes.has(o.groupe)) groupes.set(o.groupe, o.region); }
  for (const [g, r] of groupes) bloc(`Groupe de ressources ${g}`, ['Chemin : Groupes de ressources > + Créer', `Abonnement : celui du cours ; nom : ${g} ; région : ${lieuRegion(r)}`,
    'Piège : une ressource et le réseau virtuel auquel elle se rattache doivent être dans la même région (une table de routage n’apparaît pas dans la liste d’association sinon).'], `la liste du groupe ${g} une fois tout créé`);

  // 2. Réseaux virtuels et sous-réseaux
  for (const v of ctx.vnets) {
    const sous = ctx.sousReseaux.filter((x) => x.vnet?.id === v.id);
    bloc(`Réseau virtuel ${v.nom}`, [
      'Chemin : Réseaux virtuels > + Créer',
      `Onglet Informations de base : groupe de ressources = ${v.groupe} ; nom = ${v.nom} ; région = ${lieuRegion(v.region)}`,
      `Onglet Adresses IP : espace d’adressage = ${v.c.espace || '(à choisir)'} ; supprime le sous-réseau « default » ; ajoute :`,
      ...sous.map((s) => `   - sous-réseau ${s.nom} : ${s.c.plage || '(plage à choisir)'}${s.c.delegation ? ` ; délégation = ${DELEGATIONS.find(([d]) => d === s.c.delegation)?.[1] ?? s.c.delegation}` : ''}${s.c.pointsService.length ? ` ; points de terminaison de service = ${s.c.pointsService.join(', ')}` : ''}`),
      v.c.dns ? `Serveurs DNS : personnalisés = ${v.c.dns}` : 'Serveurs DNS : par défaut (Azure).',
      'Piège : les noms GatewaySubnet, AzureFirewallSubnet et AzureBastionSubnet s’écrivent exactement ainsi (sans tiret, sans suffixe) ; un sous-réseau ne se renomme pas, il faut le supprimer et le recréer.',
    ], `la page « Sous-réseaux » de ${v.nom}`);
  }

  // 3. Appairages
  const paires = new Set();
  for (const v of ctx.vnets) for (const id of v.c.appairages) {
    const w = ctx.vnets.find((x) => x.id === id); if (!w) continue;
    const cle = [v.id, w.id].sort().join('|'); if (paires.has(cle)) continue; paires.add(cle);
    bloc(`Appairage ${v.nom} ↔ ${w.nom}`, [
      `Chemin : Réseaux virtuels > ${v.nom} > Appairages (Peerings) > + Ajouter`,
      `Ce réseau virtuel : nom du lien = ${v.nom}-vers-${w.nom} ; accès au réseau virtuel = ${v.c.accesVnet ? 'autorisé' : 'bloqué'}`,
      `Réseau virtuel distant : nom du lien = ${w.nom}-vers-${v.nom} ; réseau virtuel = ${w.nom} ; accès = ${w.c.accesVnet ? 'autorisé' : 'bloqué'}`,
      'Le portail crée les deux moitiés en une fois ; vérifie que les deux disent « Connected » et « Synchronisation complète ».',
    ], `la page « Peerings » de ${v.nom} ET celle de ${w.nom} (état Connected)`);
  }

  // 4. Ressources, dans l'ordre de déploiement
  const noeuds = schema.noeuds.filter((n) => estAzure(n.type)).sort((a, b) => ORDRE.indexOf(a.type) - ORDRE.indexOf(b.type));
  const zonesFaites = new Set();
  for (const n of noeuds) {
    const c = normaliserConfigAzure(n.type, n.config) ?? {}; const o = ctx.noeud(n); const nom = nomAzure(n.nom, n.type);
    const portail = typeAzure(n.type)?.portail;
    const base = `Onglet Informations de base : groupe de ressources = ${o.groupe} ; nom = ${nom} ; région = ${lieuRegion(o.region)}`;
    switch (n.type) {
      case 'stockage': {
        const pe = schema.noeuds.filter((x) => x.type === 'point-terminaison-prive' && cibleDuPe(schema, x)?.id === n.id);
        bloc(`Compte de stockage ${nom}`, [
          `Chemin : ${portail}`, base, `Redondance = ${c.sku}`,
          'Onglet Mise en réseau : laisse l’accès public ouvert PENDANT la création du contenu, puis ferme-le (voir plus bas).',
          liste(c.conteneurs).length ? `Après création, Stockage des données > Conteneurs > + Conteneur : ${liste(c.conteneurs).map((x) => nomAzure(x).toLowerCase()).join(', ')} ; ouvre le premier et charge un fichier de ton choix.` : '',
          liste(c.files).length ? `Stockage des données > Files d’attente > + File d’attente : ${liste(c.files).map((x) => nomAzure(x).toLowerCase()).join(', ')}.` : '',
          liste(c.partages).length ? `Stockage des données > Partages de fichiers > + Partage : ${liste(c.partages).join(', ')}.` : '',
          c.acces === 'desactive' ? `Ensuite, Sécurité + réseau > Mise en réseau > Accès au réseau public = Désactivé${pe.length ? ` (l’accès passera par ${pe.map((x) => nomAzure(x.nom)).join(', ')})` : ''}.` : '',
          'Piège : le nom du conteneur et de la file doivent être EXACTEMENT ceux de l’énoncé (par exemple blob1, pas conteneur-blob1) : une application qui les cherche par leur nom échoue sinon.',
          'Piège : depuis le portail ou une VM, l’accès aux données demande un rôle « Contributeur aux données » ou la clé du compte ; propriétaire du compte ne suffit pas. Les clés se copient dans le portail, jamais dans ce document.',
        ], `les conteneurs (avec le fichier), les files d’attente, et la page « Mise en réseau »${c.acces === 'desactive' ? ' (accès public désactivé)' : ''}`);
        break;
      }
      case 'app-service': {
        const integ = c.integration ? sn(c.integration) : null;
        bloc(`App Service ${nom}`, [
          `Chemin : ${portail}`, base,
          `Plan App Service : ${c.plan || `asp-${nom}`} ; niveau tarifaire = ${c.sku}`,
          c.pile === 'conteneur' ? 'Publication = Conteneur ; système d’exploitation = Linux' : `Publication = Code ; pile = ${c.pile}`,
          c.pile === 'conteneur' ? `Onglet Conteneur : source de l’image = Autres registres de conteneurs ; image et étiquette = ${c.image || '(à choisir)'} ; URL du serveur de registre = ${c.registre || 'https://index.docker.io'} ; port = ${c.port || '8080'}` : '',
          ...c.chaines.filter((ch) => ch.nom).map((ch) => {
            const st = schema.noeuds.find((x) => x.id === ch.source);
            return `Paramètres > Variables d’environnement > Chaînes de connexion > + Ajouter : nom = ${ch.nom} ; type = ${ch.genre || 'Custom'} ; valeur = chaîne de connexion de ${st ? nomAzure(st.nom, 'stockage') : 'la ressource'} (copie-la depuis Clés d’accès, ne l’écris pas ici).`;
          }),
          integ ? `Réseau > Intégration du réseau virtuel > Ajouter : réseau virtuel = ${integ.vnet?.nom} ; sous-réseau = ${integ.nom}. Demande au moins le niveau B1.` : '',
          c.acces === 'desactive' ? 'Réseau > Accès au réseau public : désactivé, à faire APRÈS la création du point de terminaison privé de l’application (l’accès passe ensuite par lui).' : '',
          ...c.restrictions.filter((r) => r.nom).map((r) => `Réseau > Accès au réseau public > restriction « ${r.nom} » : ${r.action || 'Allow'} ${r.source || ''} (priorité ${r.priorite || 100})`),
          'Coût : le plan B1 est facturé tant qu’il existe ; repasse le plan à F1 (Mettre à l’échelle) quand tu ne travailles pas, puis remets B1 avant l’intégration VNet ou le point privé.',
        ], 'la page de l’application avec son plan, puis les pages de test de l’application, et la page « Réseau »');
        break;
      }
      case 'point-terminaison-prive': {
        const cible = cibleDuPe(schema, n);
        const s = c.sousReseau ? sn(c.sousReseau) : o.sousReseau;
        const sr = SOUS_RESSOURCES[cible?.type] ?? []; const choix = sr.find(([g]) => g === c.sousRessource) ?? sr[0];
        const zone = choix?.[1] ?? '';
        const vnets = new Set([s?.vnet?.id].filter(Boolean));
        for (const v of ctx.vnets) if (s?.vnet && (v.c.appairages.includes(s.vnet.id) || s.vnet.c.appairages.includes(v.id))) vnets.add(v.id);
        for (const v of vnetsConsommateurs(schema, ctx, cible)) vnets.add(v);
        const noms = [...vnets].map((id) => ctx.vnets.find((x) => x.id === id)?.nom).filter(Boolean);
        const autres = [...vnets].filter((id) => id !== s?.vnet?.id).map((id) => ctx.vnets.find((x) => x.id === id)?.nom).filter(Boolean);
        const lignes = [
          `Chemin : ${portail}`, base,
          `Onglet Ressource : type = ${cible ? typeAzure(cible.type).label : '(à choisir)'} ; ressource = ${cible ? nomAzure(cible.nom, cible.type) : '(à choisir)'} ; sous-ressource cible = ${choix?.[0] ?? c.sousRessource}`,
          `Onglet Réseau virtuel : réseau virtuel = ${s?.vnet?.nom ?? '?'} ; sous-réseau = ${s?.nom ?? '?'}${c.ip ? ` ; IP privée statique = ${c.ip}` : ' ; IP privée dynamique'}`,
          c.dns && zone ? `Onglet DNS : intégrer à une zone DNS privée = Oui ; zone = ${zone} (créée automatiquement si elle n’existe pas).` : 'Onglet DNS : intégration non demandée.',
        ];
        if (c.dns && zone) {
          lignes.push(`PIÈGE FRÉQUENT : le portail ne lie la zone qu’au réseau virtuel du point de terminaison. Les autres réseaux qui doivent résoudre ce nom (${autres.join(', ') || 'aucun autre'}) restent sur l’adresse publique, donc refusés si l’accès public est fermé.`);
          if (!zonesFaites.has(zone)) {
            zonesFaites.add(zone);
            lignes.push(`Pour ${zone} : Zones DNS privées > ${zone} > Liens de réseau virtuel : il doit y avoir UN lien par réseau de la liste (${noms.join(', ') || '—'}). Ajoute les manquants avec + Ajouter, inscription automatique DÉCOCHÉE (un seul lien avec inscription par réseau).`);
          } else lignes.push(`Même zone ${zone} déjà vue plus haut : ses liens couvrent la même liste de réseaux.`);
          lignes.push(`Test : depuis une VM du réseau, nslookup ${cible ? nomAzure(cible.nom, cible.type).toLowerCase() : '<ressource>'}.${zone.replace('privatelink.', '')} doit répondre une adresse privée (${s?.c.plage || 'celle du sous-réseau'}).`);
        }
        bloc(`Point de terminaison privé ${nom}`, lignes, `la page de validation « Vérifier + créer », le déploiement terminé${c.dns && zone ? `, et « Liens de réseau virtuel » de ${zone}` : ''}`);
        break;
      }
      case 'table-routage': {
        const sous = c.sousReseaux.map((id) => sn(id)).filter(Boolean);
        bloc(`Table de routage ${nom}`, [
          `Chemin : ${portail}`, `${base} ; propager les routes de la passerelle = ${c.sansBgp ? 'Non' : 'Oui (par défaut)'}`,
          'Puis Paramètres > Itinéraires (Routes) > + Ajouter, une route par ligne :',
          ...c.routes.map((r) => `   - ${r.nom || 'route'} : destination = ${/^[\d.]+\/\d+$/.test(r.prefixe) ? `Adresses IP, préfixe ${r.prefixe}` : `Étiquette de service, ${r.prefixe}`} ; prochain saut = ${saut(r.saut)}${r.saut === 'VirtualAppliance' ? `, adresse ${r.ip}` : ''}`),
          `Puis Paramètres > Sous-réseaux > Associer : ${sous.map(nomSn).join(' ; ') || '(aucun)'}.`,
          'Piège : « Aucun » (None) supprime le trafic ; une appliance fictive n’a rien à créer, seule son adresse compte.',
        ], 'la liste des routes, la liste des sous-réseaux associés, et la colonne « Table de routage » des réseaux concernés');
        break;
      }
      case 'appliance':
        if (c.fictive) { bloc(`Appliance fictive ${nom}`, [`Rien à créer dans le portail : l’appliance n’existe pas. Son adresse ${c.ipPrivee || '(IP)'} sert seulement de prochain saut dans les routes.`]); break; }
        bloc(`Appliance ${nom}`, [`Chemin : ${portail}`, base, `Réseau : ${o.vnet?.nom ?? '?'} / ${o.sousReseau?.nom ?? '?'}${c.ipPrivee ? ` ; IP privée statique = ${c.ipPrivee}` : ''}`, 'Sur la carte réseau : Paramètres IP > Activer le transfert IP.', 'Dans la VM : activer le routage du système.'], 'la machine avec son IP privée et le transfert IP');
        break;
      case 'vm':
        bloc(`Machine virtuelle ${nom}`, [`Chemin : ${portail}`, base, `Image = ${c.image} ; taille = ${c.taille}`, `Onglet Réseau : réseau virtuel = ${o.vnet?.nom ?? '?'} ; sous-réseau = ${o.sousReseau?.nom ?? '?'} ; IP publique = ${c.ipPublique ? 'oui' : 'aucune'}`,
          'Le mot de passe ou la clé se choisit dans le portail : ne les écris jamais dans ce document.'], 'la page de la machine avec son IP privée');
        break;
      case 'nsg':
        bloc(`NSG ${nom}`, [`Chemin : ${portail}`, base, 'Règles de sécurité entrantes/sortantes, une par ligne :',
          ...c.regles.map((r) => `   - ${r.nom || 'règle'} : priorité ${r.priorite}, ${r.direction === 'Inbound' ? 'entrant' : 'sortant'}, ${r.acces === 'Allow' ? 'autoriser' : 'refuser'}, ${r.protocole}, source ${r.source || '*'}, ports ${r.ports || '*'}, destination ${r.destination || '*'}`),
          `Associer aux sous-réseaux : ${c.sousReseaux.map((id) => nomSn(sn(id))).join(' ; ') || '(aucun)'}.`], 'les règles et les sous-réseaux associés');
        break;
      case 'zone-dns': {
        const vn = c.vnets.map((id) => ctx.vnets.find((x) => x.id === id)?.nom).filter(Boolean);
        bloc(`Zone DNS ${c.privee ? 'privée' : 'publique'} ${c.domaine || nom}`, [`Chemin : ${portail}`, `${base.replace(`nom = ${nom}`, `nom = ${c.domaine || '(domaine)'}`)}`,
          c.privee ? `Liens de réseau virtuel : ${vn.join(', ') || '(aucun)'}${c.inscription ? ' ; inscription automatique des VM activée' : ' ; inscription automatique décochée'}.` : '',
          ...c.enregistrements.filter((r) => r.nom || r.valeur).map((r) => `Jeux d’enregistrements > + Ajouter : nom = ${r.nom || '@'} ; type = ${r.genre} ; valeur = ${r.valeur}`)], 'les liens de réseau virtuel et les enregistrements');
        break;
      }
      default:
        bloc(`${typeAzure(n.type)?.label ?? n.type} ${nom}`, [portail ? `Chemin : ${portail}` : '', base, 'Les autres réglages se lisent dans le formulaire du labo (panneau de la ressource).'], 'la page de la ressource une fois créée');
    }
  }

  // 5. Contrôles avant d'appliquer
  const avert = verifierAzure(schema);
  blocs.unshift({ titre: 'Portail : lis ceci avant de cliquer', lignes: [
    'Ce plan est généré depuis le schéma : applique-le dans l’ordre, de haut en bas. Les libellés peuvent différer légèrement de ton portail.',
    avert.length ? `Le schéma signale ${avert.length} point(s) à régler AVANT d’appliquer : ${avert.slice(0, 5).join(' | ')}${avert.length > 5 ? ' | …' : ''}` : 'Le schéma ne signale aucun problème.',
    `Pour chaque étape : ${COMPTE}. Nomme tes captures par exercice ou par ressource et rédige une légende (ce qu’elle prouve).`,
  ] });
  return { blocs, captures };
}
