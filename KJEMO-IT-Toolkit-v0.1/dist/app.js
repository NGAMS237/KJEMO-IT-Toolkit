const esc = (value) => String(value ?? "").replace(/'/g, "''");
const domainToDn = (domain) => String(domain).trim().split('.').filter(Boolean).map((part) => `DC=${part}`).join(',');

const tools = [
  {
    id: 'static-ip', icon: '◈', category: 'Réseau', title: 'Configurer une IP statique', risk: 'caution',
    summary: 'Configure IPv4, passerelle et DNS sur une carte Windows.',
    fields: [
      { id: 'adapter', label: 'Nom de la carte réseau', default: 'Ethernet', help: 'Vérifie avec Get-NetAdapter.' },
      { id: 'ip', label: 'Adresse IPv4', default: '192.168.30.253' },
      { id: 'prefix', label: 'Préfixe réseau', type: 'number', default: '24', help: '24 correspond au masque 255.255.255.0.' },
      { id: 'gateway', label: 'Passerelle', default: '192.168.30.254' },
      { id: 'dns', label: 'DNS préféré', default: '192.168.30.254' },
    ],
    generate: (v) => `# Exécuter PowerShell en administrateur\n# Vérification préalable\nGet-NetAdapter\nGet-NetIPConfiguration -InterfaceAlias '${esc(v.adapter)}'\n\n# Désactiver DHCP et ajouter l’adresse statique\nSet-NetIPInterface -InterfaceAlias '${esc(v.adapter)}' -AddressFamily IPv4 -Dhcp Disabled\nNew-NetIPAddress -InterfaceAlias '${esc(v.adapter)}' -IPAddress '${esc(v.ip)}' -PrefixLength ${v.prefix} -DefaultGateway '${esc(v.gateway)}'\n\n# Définir le DNS\nSet-DnsClientServerAddress -InterfaceAlias '${esc(v.adapter)}' -ServerAddresses '${esc(v.dns)}'\n\n# Vérification\nGet-NetIPConfiguration -InterfaceAlias '${esc(v.adapter)}'`,
    gui: ['Ouvrir Paramètres > Réseau et Internet > Paramètres réseau avancés.', 'Cliquer sur la carte concernée puis Modifier à côté de l’attribution IP.', 'Choisir Manuel, activer IPv4 et saisir IP, préfixe, passerelle et DNS.', 'Enregistrer puis ouvrir une console et vérifier avec ipconfig /all.'],
    checks: ['La carte visée doit être la bonne : une erreur peut couper l’accès réseau.', 'Si cette adresse existe déjà, supprimer ou modifier l’ancienne configuration avant de lancer New-NetIPAddress.'],
    source: 'https://learn.microsoft.com/powershell/module/nettcpip/new-netipaddress'
  },
  {
    id: 'ad-ou', icon: '⌘', category: 'Active Directory', title: 'Créer une unité d’organisation', risk: 'safe',
    summary: 'Crée une OU protégée contre les suppressions accidentelles.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'ou', label: 'Nom de la nouvelle OU', default: 'Employes' },
      { id: 'parent', label: 'OU parente (facultatif)', default: '', help: 'Exemple : Administration. Laisser vide pour la racine du domaine.' },
      { id: 'whatif', label: 'Mode test', type: 'select', default: 'true', options: [['true', 'Oui — ne rien créer'], ['false', 'Non — créer réellement']] },
    ],
    generate: (v) => { const dn = domainToDn(v.domain); const path = v.parent ? `OU=${esc(v.parent)},${dn}` : dn; const full = `OU=${esc(v.ou)},${path}`; return `Import-Module ActiveDirectory\n\n$OuName = '${esc(v.ou)}'\n$OuPath = '${path}'\n$OuDn = '${full}'\n\nif (Get-ADOrganizationalUnit -Identity $OuDn -ErrorAction SilentlyContinue) {\n    Write-Warning "L’OU existe déjà : $OuDn"\n}\nelse {\n    New-ADOrganizationalUnit -Name $OuName -Path $OuPath -ProtectedFromAccidentalDeletion $true${v.whatif === 'true' ? ' -WhatIf' : ''}\n}\n\nGet-ADOrganizationalUnit -Identity $OuDn`; },
    gui: ['Ouvrir Gestionnaire de serveur > Outils > Utilisateurs et ordinateurs Active Directory.', 'Développer le domaine puis cliquer droit sur le conteneur parent.', 'Choisir Nouveau > Unité d’organisation.', 'Saisir le nom et conserver la protection contre la suppression accidentelle.'],
    checks: ['Le module ActiveDirectory est disponible sur un contrôleur de domaine ou avec RSAT.', 'Créer l’OU parente avant une sous-OU.'],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-adorganizationalunit'
  },
  {
    id: 'ad-user', icon: '◉', category: 'Active Directory', title: 'Créer un utilisateur AD', risk: 'caution',
    summary: 'Crée un utilisateur, demande le mot de passe localement et force son changement à la première ouverture.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'ou', label: 'Nom de l’OU', default: 'Employes' },
      { id: 'firstName', label: 'Prénom', default: 'Marie' },
      { id: 'lastName', label: 'Nom', default: 'Tremblay' },
      { id: 'sam', label: 'Identifiant (SamAccountName)', default: 'mtremblay' },
      { id: 'whatif', label: 'Mode test', type: 'select', default: 'true', options: [['true', 'Oui — ne rien créer'], ['false', 'Non — créer réellement']] },
    ],
    generate: (v) => { const dn = `OU=${esc(v.ou)},${domainToDn(v.domain)}`; const name = `${esc(v.firstName)} ${esc(v.lastName)}`; return `Import-Module ActiveDirectory\n\n$UserName = '${name}'\n$Sam = '${esc(v.sam)}'\n$Path = '${dn}'\n$Password = Read-Host 'Mot de passe temporaire' -AsSecureString\n\nif (Get-ADUser -Filter "SamAccountName -eq '$Sam'" -ErrorAction SilentlyContinue) {\n    Write-Warning "L’utilisateur $Sam existe déjà."\n}\nelse {\n    New-ADUser -Name $UserName -GivenName '${esc(v.firstName)}' -Surname '${esc(v.lastName)}' \\\n        -SamAccountName $Sam -UserPrincipalName "$Sam@${esc(v.domain)}" -Path $Path \\\n        -AccountPassword $Password -Enabled $true -ChangePasswordAtLogon $true${v.whatif === 'true' ? ' -WhatIf' : ''}\n}\n\nGet-ADUser -Identity $Sam -Properties Enabled,UserPrincipalName |\n    Select-Object Name,SamAccountName,Enabled,UserPrincipalName`; },
    gui: ['Ouvrir Utilisateurs et ordinateurs Active Directory.', 'Ouvrir l’OU voulue puis cliquer droit > Nouveau > Utilisateur.', 'Saisir prénom, nom et identifiant.', 'Saisir un mot de passe temporaire et cocher « L’utilisateur doit changer le mot de passe ».'],
    checks: ['Le script ne stocke pas le mot de passe dans le fichier.', 'Vérifier que l’OU existe avant création.'],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/new-aduser'
  },
  {
    id: 'shared-folder', icon: '▣', category: 'Fichiers & imprimantes', title: 'Créer un dossier partagé', risk: 'caution',
    summary: 'Crée le dossier, le partage SMB et donne un accès à un groupe AD.',
    fields: [
      { id: 'path', label: 'Chemin local', default: 'D:\Partages\Comptabilite' },
      { id: 'share', label: 'Nom du partage', default: 'Comptabilite' },
      { id: 'group', label: 'Groupe AD autorisé', default: 'GG-Comptabilite-RW' },
      { id: 'access', label: 'Niveau de partage', type: 'select', default: 'Change', options: [['Change', 'Modification'], ['Read', 'Lecture'], ['Full', 'Contrôle total']] },
    ],
    generate: (v) => `# Exécuter sur le serveur de fichiers en administrateur\n$Path = '${esc(v.path)}'\n$ShareName = '${esc(v.share)}'\n$Group = '${esc(v.group)}'\n\n# Créer le dossier s’il n’existe pas\nif (-not (Test-Path -LiteralPath $Path)) {\n    New-Item -Path $Path -ItemType Directory\n}\n\n# Créer le partage SMB s’il n’existe pas\nif (-not (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue)) {\n    New-SmbShare -Name $ShareName -Path $Path -FullAccess 'BUILTIN\\Administrators'\n}\n\n# Définir l’accès au partage et NTFS\nGrant-SmbShareAccess -Name $ShareName -AccountName $Group -AccessRight ${v.access} -Force\nicacls $Path /grant "${esc(v.group)}:(OI)(CI)M"\n\n# Vérification\nGet-SmbShare -Name $ShareName\nGet-SmbShareAccess -Name $ShareName`,
    gui: ['Créer d’abord le dossier dans l’Explorateur de fichiers.', 'Cliquer droit > Propriétés > Partage > Partage avancé.', 'Cocher « Partager ce dossier », définir le nom puis régler les autorisations.', 'Dans l’onglet Sécurité, ajouter le groupe AD et ses permissions NTFS.'],
    checks: ['Les permissions du partage et NTFS s’additionnent : l’accès réel est le plus restrictif.', 'Utilise idéalement des groupes, pas des utilisateurs individuels.'],
    source: 'https://learn.microsoft.com/powershell/module/smbshare/new-smbshare'
  },
  {
    id: 'second-dc', icon: '⇄', category: 'Active Directory', title: 'Ajouter un deuxième contrôleur', risk: 'caution',
    summary: 'Prépare la promotion d’un serveur déjà joint au domaine.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'source', label: 'Contrôleur source', default: 'srvh1bn.hopitalbn.lan' },
      { id: 'dns', label: 'DNS actuel du serveur source', default: '192.168.30.254' },
    ],
    generate: (v) => `# Conditions : IP statique, DNS vers le premier contrôleur et serveur déjà joint au domaine\n# Vérifications\nResolve-DnsName '${esc(v.source)}'\nTest-ComputerSecureChannel -Verbose\nTest-NetConnection '${esc(v.source)}' -Port 135\nTest-NetConnection '${esc(v.source)}' -Port 389\n\n# Installer le rôle si nécessaire\nInstall-WindowsFeature AD-Domain-Services -IncludeManagementTools\n\n# Promouvoir le serveur — le mot de passe DSRM sera demandé\nInstall-ADDSDomainController \\\n    -DomainName '${esc(v.domain)}' \\\n    -ReplicationSourceDC '${esc(v.source)}' \\\n    -InstallDns:$true \\\n    -CreateDnsDelegation:$false \\\n    -Credential (Get-Credential)\n\n# Après le redémarrage, vérifier depuis un contrôleur de domaine :\n# Get-ADDomainController -Filter *\n# repadmin /replsummary`,
    gui: ['Ouvrir Gestionnaire de serveur > Ajouter des rôles et fonctionnalités.', 'Ajouter Services AD DS puis terminer l’assistant.', 'Cliquer sur la notification puis « Promouvoir ce serveur en contrôleur de domaine ».', 'Choisir « Ajouter un contrôleur de domaine à un domaine existant », saisir le domaine et les identifiants.'],
    checks: ['Ne pas utiliser un DNS public sur le serveur à promouvoir.', 'Vérifier le canal sécurisé et les ports avant la promotion.', 'Le serveur redémarre automatiquement si l’installation réussit.'],
    source: 'https://learn.microsoft.com/windows-server/identity/ad-ds/deploy/install-active-directory-domain-services--level-100'
  },
  {
    id: 'wifi-repair', icon: '⌁', category: 'Dépannage Windows', title: 'Diagnostiquer et réinitialiser le Wi-Fi', risk: 'caution',
    summary: 'Vérifie la carte et le service WLAN, puis redémarre la carte choisie.',
    fields: [{ id: 'adapter', label: 'Nom de la carte Wi-Fi', default: 'Wi-Fi', help: 'Utilise d’abord le bloc diagnostic pour confirmer le nom.' }],
    generate: (v) => `# DIAGNOSTIC — ne modifie rien\nGet-Service WlanSvc\nGet-NetAdapter -Physical | Format-Table Name,Status,LinkSpeed,InterfaceDescription -Auto\nnetsh wlan show interfaces\nnetsh wlan show networks mode=bssid\n\n# RÉPARATION LÉGÈRE — redémarre le service WLAN et la carte choisie\nStart-Service WlanSvc\nDisable-NetAdapter -Name '${esc(v.adapter)}' -Confirm:$false\nStart-Sleep -Seconds 3\nEnable-NetAdapter -Name '${esc(v.adapter)}' -Confirm:$false\n\n# Rechercher les périphériques réinstallés ou nouvellement détectés\npnputil /scan-devices\n\n# Vérifier de nouveau les réseaux\nnetsh wlan show networks mode=bssid`,
    gui: ['Ouvrir Gestionnaire de périphériques > Cartes réseau.', 'Repérer la carte Wi-Fi puis choisir Désactiver l’appareil et Réactiver l’appareil.', 'Si cela ne résout rien : clic droit > Désinstaller l’appareil, puis Action > Rechercher les modifications sur le matériel.', 'Télécharger le pilote depuis le fabricant seulement si Windows ne réinstalle pas la carte.'],
    checks: ['Le nom de la carte doit être exact avant la désactivation.', 'La désinstallation du pilote est une solution de second niveau : commence toujours par redémarrer la carte.'],
    source: 'https://learn.microsoft.com/windows-hardware/drivers/devtest/pnputil-command-syntax'
  },
  {
    id: 'disk-scan', icon: '◫', category: 'Stockage', title: 'Repérer les dossiers lourds', risk: 'diagnostic',
    summary: 'Analyse un disque sans rien supprimer et exporte les résultats dans un CSV.',
    fields: [{ id: 'path', label: 'Dossier ou disque à analyser', default: 'C:\\' }, { id: 'top', label: 'Nombre de résultats', type: 'number', default: '30' }],
    generate: (v) => `# ANALYSE UNIQUEMENT — aucune suppression\n$TargetPath = '${esc(v.path)}'\n$Top = ${v.top}\n$ExportPath = Join-Path $env:USERPROFILE 'Desktop\\KJEMO-Disk-Scan.csv'\n\nif (-not (Test-Path -LiteralPath $TargetPath)) {\n    throw "Chemin introuvable : $TargetPath"\n}\n\n$Results = Get-ChildItem -LiteralPath $TargetPath -Directory -Force -ErrorAction SilentlyContinue |\n    ForEach-Object {\n        $bytes = (Get-ChildItem -LiteralPath $_.FullName -File -Recurse -Force -ErrorAction SilentlyContinue |\n            Measure-Object -Property Length -Sum).Sum\n        [PSCustomObject]@{\n            Dossier = $_.FullName\n            TailleGB = [math]::Round(($bytes / 1GB), 2)\n            TailleMB = [math]::Round(($bytes / 1MB), 0)\n        }\n    } | Sort-Object TailleGB -Descending\n\n$Results | Select-Object -First $Top | Format-Table -AutoSize\n$Results | Export-Csv -Path $ExportPath -NoTypeInformation -Encoding UTF8\nWrite-Host "Rapport créé : $ExportPath" -ForegroundColor Green\n\n# Examine les résultats avant toute suppression.\n# Ne supprime pas .git, .env, documents, bases de données ou sauvegardes sans vérification.`,
    gui: ['Ouvrir Paramètres > Système > Stockage pour un résumé rapide.', 'Ouvrir l’Explorateur, cliquer droit sur un disque > Propriétés pour voir l’espace total.', 'Pour les projets, examiner d’abord node_modules, .next, dist, build et les caches : ils peuvent souvent être régénérés.', 'Mettre les éléments vérifiés dans la corbeille avant toute suppression définitive.'],
    checks: ['Le scan peut prendre du temps sur un gros disque.', 'Le script ne supprime rien : il produit seulement un rapport CSV.', 'Pour un projet SaaS, ne touche jamais à .env ni à .git sans être certain.'],
    source: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem'
  },
  {
    id: 'gpo-password', icon: '⚿', category: 'GPO', title: 'Politique de mots de passe du domaine', risk: 'caution',
    summary: 'Prépare la politique par défaut du domaine avec validation et aperçu.',
    fields: [
      { id: 'domain', label: 'Nom du domaine', default: 'hopitalbn.lan' },
      { id: 'length', label: 'Longueur minimale', type: 'number', default: '12' },
      { id: 'lockout', label: 'Tentatives avant verrouillage', type: 'number', default: '5' },
      { id: 'minutes', label: 'Minutes de verrouillage', type: 'number', default: '30' },
    ],
    generate: (v) => `Import-Module ActiveDirectory\n\n# Aperçu de la politique actuelle\nGet-ADDefaultDomainPasswordPolicy -Identity '${esc(v.domain)}'\n\n# Appliquer la nouvelle politique\nSet-ADDefaultDomainPasswordPolicy -Identity '${esc(v.domain)}' \\\n    -ComplexityEnabled $true \\\n    -MinPasswordLength ${v.length} \\\n    -LockoutThreshold ${v.lockout} \\\n    -LockoutDuration (New-TimeSpan -Minutes ${v.minutes}) \\\n    -LockoutObservationWindow (New-TimeSpan -Minutes ${v.minutes})\n\n# Vérifier après application\nGet-ADDefaultDomainPasswordPolicy -Identity '${esc(v.domain)}'`,
    gui: ['Ouvrir Gestion de la stratégie de groupe.', 'Développer la forêt, le domaine, puis clic droit sur Default Domain Policy > Modifier.', 'Aller à Configuration ordinateur > Paramètres Windows > Paramètres de sécurité > Stratégies de compte.', 'Configurer les stratégies de mot de passe et de verrouillage de compte.'],
    checks: ['Cette politique touche les utilisateurs du domaine : teste d’abord les seuils en laboratoire.', 'Une stratégie de mot de passe fine est préférable lorsqu’un groupe spécifique requiert une règle différente.'],
    source: 'https://learn.microsoft.com/powershell/module/activedirectory/set-addefaultdomainpasswordpolicy'
  },
];

const categories = ['Tout', ...new Set(tools.map((tool) => tool.category))];
let selectedCategory = 'Tout';
let currentTool = null;
let currentTab = 'assistant';

function renderNavigation() {
  const nav = document.querySelector('#navigation');
  nav.innerHTML = categories.map((category) => {
    const count = category === 'Tout' ? tools.length : tools.filter((tool) => tool.category === category).length;
    return `<button data-category="${category}" class="${category === selectedCategory ? 'active' : ''}">${category}<span class="nav-count">${count}</span></button>`;
  }).join('');
  nav.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category; currentTool = null; render(); document.querySelector('.sidebar').classList.remove('open');
  }));
}

function filteredTools() {
  const query = document.querySelector('#search').value.trim().toLocaleLowerCase('fr');
  return tools.filter((tool) => (selectedCategory === 'Tout' || tool.category === selectedCategory) && `${tool.title} ${tool.summary} ${tool.category}`.toLocaleLowerCase('fr').includes(query));
}

function renderHome() {
  const grid = document.querySelector('#toolGrid');
  const list = filteredTools();
  document.querySelector('#toolCount').textContent = `${list.length} outil${list.length > 1 ? 's' : ''}`;
  grid.innerHTML = '';
  if (!list.length) { grid.innerHTML = '<div class="empty">Aucun outil ne correspond à cette recherche.</div>'; return; }
  const template = document.querySelector('#toolTemplate');
  list.forEach((tool) => {
    const card = template.content.cloneNode(true);
    card.querySelector('.tool-icon').textContent = tool.icon;
    card.querySelector('.tag').textContent = tool.category.toUpperCase();
    card.querySelector('h3').textContent = tool.title;
    card.querySelector('p').textContent = tool.summary;
    card.querySelector('.open-tool').addEventListener('click', () => { currentTool = tool; currentTab = 'assistant'; render(); });
    grid.append(card);
  });
}

function formMarkup(tool) {
  return tool.fields.map((field) => `<div class="field"><label for="${field.id}">${field.label}</label>${field.type === 'select' ? `<select id="${field.id}">${field.options.map(([value, label]) => `<option value="${value}" ${value === field.default ? 'selected' : ''}>${label}</option>`).join('')}</select>` : `<input id="${field.id}" type="${field.type || 'text'}" value="${field.default || ''}" />`}${field.help ? `<small>${field.help}</small>` : ''}</div>`).join('');
}

function getValues(tool) { return Object.fromEntries(tool.fields.map((field) => [field.id, document.querySelector(`#${field.id}`).value])); }

function textToCode(text) { return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char])); }
function normalizeScript(text) { return text.replace(/\\\n/g, String.fromCharCode(96) + '\n'); }

function renderTool() {
  const tool = currentTool;
  const view = document.querySelector('#toolView');
  const riskLabels = { diagnostic: 'DIAGNOSTIC — aucune modification', safe: 'RÉVERSIBLE — vérifier avant exécution', caution: 'ATTENTION — modifie la configuration', destructive: 'DESTRUCTIF — confirmation indispensable' };
  view.innerHTML = `<div class="tool-header"><button class="back-button" id="backButton">← Tous les outils</button><div><div class="tag">${tool.category.toUpperCase()}</div><h1>${tool.icon} ${tool.title}</h1><p>${tool.summary}</p><span class="risk ${tool.risk}">${riskLabels[tool.risk]}</span></div></div><div class="tabs"><button class="tab ${currentTab === 'assistant' ? 'active' : ''}" data-tab="assistant">Assistant</button><button class="tab ${currentTab === 'script' ? 'active' : ''}" data-tab="script">Script</button><button class="tab ${currentTab === 'gui' ? 'active' : ''}" data-tab="gui">Interface graphique</button></div><div id="tabContent"></div>`;
  view.querySelector('#backButton').addEventListener('click', () => { currentTool = null; render(); });
  view.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { currentTab = tab.dataset.tab; renderTool(); }));
  const content = view.querySelector('#tabContent');
  if (currentTab === 'gui') {
    content.innerHTML = `<div class="panel"><h2>Étapes avec l’interface Windows</h2><ol class="steps">${tool.gui.map((step) => `<li>${step}</li>`).join('')}</ol><div class="details"><h3>Avant de commencer</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div></div>`;
    return;
  }
  const script = normalizeScript(tool.generate(Object.fromEntries(tool.fields.map((field) => [field.id, field.default || '']))));
  content.innerHTML = `<div class="tool-content"><section class="panel"><h2>${currentTab === 'assistant' ? 'Tes informations' : 'Paramètres du script'}</h2><form id="toolForm">${formMarkup(tool)}<button class="primary-button" type="submit">${currentTab === 'assistant' ? 'Générer le script' : 'Actualiser l’aperçu'}</button></form><div class="details"><h3>Vérifications</h3><ul>${tool.checks.map((check) => `<li>${check}</li>`).join('')}</ul><p>Référence : <a class="source-link" target="_blank" rel="noreferrer" href="${tool.source}">documentation officielle</a></p></div></section><section class="panel"><h2>Aperçu PowerShell</h2><div class="code-wrap"><pre id="scriptOutput" class="code">${textToCode(script)}</pre></div><div class="code-actions"><button id="copyButton" class="secondary-button">Copier</button><button id="downloadButton" class="secondary-button">Télécharger .ps1</button></div><span id="copyFeedback" class="copy-feedback" aria-live="polite"></span></section></div>`;
  content.querySelector('#toolForm').addEventListener('submit', (event) => { event.preventDefault(); const output = normalizeScript(tool.generate(getValues(tool))); content.querySelector('#scriptOutput').textContent = output; content.querySelector('#copyFeedback').textContent = 'Aperçu actualisé.'; });
  content.querySelector('#copyButton').addEventListener('click', async () => { try { await navigator.clipboard.writeText(content.querySelector('#scriptOutput').textContent); content.querySelector('#copyFeedback').textContent = 'Script copié dans le presse-papiers.'; } catch { content.querySelector('#copyFeedback').textContent = 'Copie impossible : sélectionne le texte manuellement.'; } });
  content.querySelector('#downloadButton').addEventListener('click', () => { const blob = new Blob([content.querySelector('#scriptOutput').textContent], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${tool.id}.ps1`; link.click(); URL.revokeObjectURL(link.href); });
}

function render() {
  renderNavigation();
  document.querySelector('#home').hidden = Boolean(currentTool);
  document.querySelector('#toolView').hidden = !currentTool;
  if (currentTool) renderTool(); else renderHome();
}

document.querySelector('#search').addEventListener('input', () => { if (!currentTool) renderHome(); });
document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
render();
