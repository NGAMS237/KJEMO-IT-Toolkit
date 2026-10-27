# Audit des cours Ubuntu AD et DNS Samba — 27 octobre 2026

Référence examinée : main b83d725. Comparaison des documents fournis avec les générateurs, procédures et commandes rapides ; aucune exécution sur un domaine réel.

| Cours / capacité | État actuel | Travail restant |
| --- | --- | --- |
| DNS, SRV, heure, ports et santé du contrôleur Samba AD | Couverture partielle existante | Réunir les vérifications dans une procédure client Ubuntu |
| Joindre Ubuntu à AD avec realmd, adcli et SSSD | Non développé | Découverte, prérequis, jonction confirmée, relecture realm/id/getent |
| Connexion utilisateur AD, création du dossier personnel, PAM | Non développé | Procédure dédiée et diagnostic SSSD ; délégation sudo séparée et limitée |
| DNS Samba : requêtes, zones, A et PTR via samba-tool dns | Non développé | Lecture seule par défaut ; création distincte, cible exacte, relecture avant/après |
| Gestion du DNS Samba depuis Windows RSAT / DNS Manager | Non développé spécifiquement | Méthodes GUI et commandes Windows pertinentes ; ne pas confondre avec le rôle DNS Windows Server |
| Résolution directe/inverse et contrôles de santé DNS | Partiellement présent | Relier les commandes existantes aux deux nouvelles procédures |

Les assistants de jonction existants sont Windows, même si le contrôleur est Samba. Ils ne réalisent pas une jonction Ubuntu. Le module Samba AD évoque samba-tool dns add comme action non effectuée : cette mention n'est pas une implémentation.

## Adaptations nécessaires des leçons

- 127.0.0.53 est normalement l'adresse du stub systemd-resolved. Vérifier les serveurs amont avec resolvectl ; ne pas désactiver le résolveur ni remplacer resolv.conf par défaut.
- Privilégier pam-auth-update pour activer mkhomedir, sans édition par défaut d'un fichier fourni par le paquet.
- Ne pas faire du mode GPO permissif une correction générale ; exposer son effet et diagnostiquer la règle d'accès.
- Ne pas donner sudo à tous les utilisateurs du domaine. Une délégation doit être ciblée et validée.
- Les valeurs du laboratoire sont des exemples paramétrables. Pour 172.27.1.0/24, la zone inverse est 1.27.172.in-addr.arpa.
- Les secrets restent saisis dans le terminal, jamais enregistrés dans une fiche ou un téléchargement.

## À développer, sans déclaration de réalisation

Ajouter des fiches courtes en Vue rapide et Pas à pas, regroupées sous Linux → domaine AD et Linux → Partages → Samba/SMB, avec liens vers les outils Windows RSAT. Étendre la traçabilité SAMBA-ADV-01 sans oublier les groupes samba-tool et les transferts smbclient déjà prévus. Aucune de ces nouvelles fonctions n'est développée par cet audit.

## Sources officielles consultées

- https://ubuntu.com/server/docs/how-to/sssd/with-active-directory/
- https://www.freedesktop.org/software/systemd/man/systemd-resolved.service.html
- https://ubuntu.com/server/docs/how-to/sssd/with-ldap/
- https://www.samba.org/samba/docs/current/man-html/samba-tool.8.html

Une consultation documentaire ne constitue pas un essai sur Ubuntu, Windows ou Samba réels.
