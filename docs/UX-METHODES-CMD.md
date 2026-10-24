# Inventaire des méthodes CMD (Invite de commandes)

Généré depuis les données (14 méthodes) ; contrôlé par `test/cmd-methodes.test.mjs`. Aucune commande n'a été exécutée sur un poste Windows réel : syntaxes relues contre la documentation Microsoft.

## Lacunes assumées

- Espace disque Windows : pas de méthode CMD. `fsutil volume diskfree <lecteur>` ne liste qu'un volume à la fois et la page Microsoft ne précise pas les droits requis ; `wmic` est obsolète. Aucun onglet vide n'est créé.
- Débloquer un compte AD, inventaire des imprimantes, état des machines Azure : pas d'équivalent CMD documenté et sûr retenu.
- CMD, PowerShell et interface graphique ne sont pas présentés comme équivalents : chaque différence d'effet, de droits ou de format est écrite dans la fiche (ex. nslookup ignore le cache DNS et le fichier hosts ; netstat CMD ne montre pas UDP ni le nom du processus ; format texte de wevtutil).

## Méthodes

### windows-voir-ip — Voir l’adresse IP d’un poste Windows

- Méthodes de la fiche : powershell, cmd, gui
- Droits : Utilisateur ordinaire.
- Paramètres : aucun
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `ipconfig /all`

### windows-etat-service — Voir l’état d’un service Windows

- Méthodes de la fiche : powershell, cmd, gui
- Droits : Utilisateur ordinaire.
- Paramètres : service (identifiant)
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `sc query {{service}}`

### vider-cache-dns — Vider le cache DNS

- Méthodes de la fiche : powershell, cmd, linux
- Droits : Invite de commandes ouverte en administrateur.
- Paramètres : aucun
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `ipconfig /flushdns`
  - `ipconfig /displaydns`

### tester-ping — Tester si une machine répond (ping)

- Méthodes de la fiche : powershell, cmd, linux
- Droits : Utilisateur ordinaire.
- Paramètres : cible (identifiant)
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `ping {{cible}}`

### resoudre-nom-dns — Résoudre un nom DNS

- Méthodes de la fiche : powershell, cmd, linux
- Droits : Utilisateur ordinaire.
- Paramètres : nom (identifiant)
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `nslookup {{nom}}`

### renouveler-bail-dhcp — Renouveler l’adresse IP (DHCP)

- Méthodes de la fiche : cmd
- Droits : Invite de commandes ouverte en administrateur.
- Paramètres : aucun
- Retour arrière : Rien à défaire : le serveur DHCP réattribue en général la même adresse.
- Commandes :
  - `ipconfig`
  - `ipconfig /release`
  - `ipconfig /renew`
  - `ipconfig /all`

### redemarrer-service-windows — Redémarrer un service Windows

- Méthodes de la fiche : powershell, cmd, gui
- Droits : Invite de commandes ouverte en administrateur.
- Paramètres : service (identifiant)
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `net stop {{service}}`
  - `net start {{service}}`
  - `sc query {{service}}`

### reparer-fichiers-systeme — Réparer les fichiers système (SFC, DISM)

- Méthodes de la fiche : cmd
- Droits : Invite de commandes ou PowerShell ouverte en administrateur.
- Paramètres : aucun
- Retour arrière : La réparation ne se défait pas ; pour garder une trace, consulte le journal CBS.log.
- Commandes :
  - `sfc /scannow`
  - `DISM /Online /Cleanup-Image /RestoreHealth`

### appliquer-strategies-groupe — Forcer l’application des stratégies de groupe

- Méthodes de la fiche : cmd
- Droits : Invite de commandes ouverte en administrateur (pour les stratégies de l’ordinateur).
- Paramètres : aucun
- Retour arrière : Rien à défaire : la commande ne modifie aucune stratégie, elle les relit.
- Commandes :
  - `gpupdate /force`
  - `gpresult /r`

### journal-evenements-windows — Lire les dernières erreurs du journal Windows

- Méthodes de la fiche : powershell, cmd, gui
- Droits : Utilisateur ordinaire pour le journal Système.
- Paramètres : aucun
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `wevtutil qe System /q:"*[System[(Level=2)]]" /c:20 /rd:true /f:text`

### ad-etat-replication — Voir l’état de la réplication Active Directory

- Méthodes de la fiche : cmd
- Droits : Invite de commandes avec un compte pouvant lire la réplication du domaine.
- Paramètres : aucun
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `repadmin /replsummary`
  - `repadmin /showrepl`

### windows-ip-fixe — Donner une adresse IP fixe à un poste Windows

- Méthodes de la fiche : powershell, cmd, gui
- Droits : Invite de commandes **en administrateur**.
- Paramètres : carte (nom), ip (ipv4), prefixe (prefixe), passerelle (ipv4), dns (ipv4)
- Retour arrière : Pour revenir à DHCP : « netsh interface ip set address name="<carte>" source=dhcp » puis « netsh interface ip set dnsserver name="<carte>" source=dhcp ».
- Commandes :
  - `ipconfig /all`
  - `netsh interface ip set address name="{{carte}}" source=static addr={{ip}} mask={{prefixeMasque}} gateway={{passerelle}}`
  - `netsh interface ip set dnsserver name="{{carte}}" source=static addr={{dns}} register=primary`
  - `ping {{passerelle}}`

### windows-ports-ecoute — Voir les ports en écoute sous Windows

- Méthodes de la fiche : powershell, cmd
- Droits : Invite ordinaire ; en administrateur pour voir tous les processus.
- Paramètres : pid (entier)
- Retour arrière : sans objet (lecture) ou non proposé
- Commandes :
  - `netstat -ano | findstr LISTENING`
  - `tasklist /fi "PID eq {{pid}}"`

### scenario-windows-diagnostic-reseau — Diagnostiquer la connexion réseau d’un poste Windows

- Méthodes de la fiche : powershell, cmd
- Droits : Utilisateur ordinaire ; le vidage du cache DNS demande une invite en administrateur.
- Paramètres : passerelle (ipv4), distant (identifiant), nomTest (identifiant)
- Retour arrière : Aucune modification n’est faite, sauf le vidage facultatif du cache DNS, qui se reconstitue tout seul.
- Commandes :
  - `ipconfig /all`
  - `ping {{passerelle}}`
  - `ping {{distant}}`
  - `nslookup {{nomTest}}`
  - `ipconfig /flushdns`

