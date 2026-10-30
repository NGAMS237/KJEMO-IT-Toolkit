/**
 * procedures-windows-langue.mjs — KJEMO-CLAVIER-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Langue, disposition du clavier et format régional d'un poste Windows : voir
 * ce qui est installé, garder une seule disposition, désactiver le raccourci
 * qui bascule de disposition, régler le format régional. Même contrat que les
 * autres fiches Windows. Non exécuté sur un poste réel.
 */
import { fiche, ps, lec, mod, src, USER, ADMIN } from './procedures-windows-simples.mjs';

const INTL = '/powershell/module/international';
const LANGUE = { id: 'langue', label: 'langue et clavier à garder', type: 'choix', choix: ['fr-CA', 'en-CA', 'en-US', 'fr-FR'], exemple: 'fr-CA', aide: 'fr-CA : français du Canada, en-US : anglais des États-Unis, fr-FR : français de France.' };

export const PROCEDURES_WINDOWS_LANGUE = [
  fiche({
    id: 'win-langue-voir', titre: 'Voir les langues, les claviers et le format régional du poste', effet: 'lecture', privileges: USER,
    resume: 'Liste les langues et dispositions de clavier installées pour ton compte, ainsi que le format régional et la langue du système. Première lecture quand le clavier change de disposition tout seul.',
    intentions: ['get-winuserlanguagelist', 'quels claviers sont installés sous windows', 'le clavier windows change tout seul', 'voir la langue et le clavier windows', 'get-culture get-winsystemlocale'],
    motsCles: ['clavier', 'langue', 'get-winuserlanguagelist', 'inputmethodtips', 'disposition', 'culture', 'région'],
    etapes: [
      lec('Langues et claviers de ton compte', 'Une ligne par langue installée, avec ses dispositions de clavier (InputMethodTips). Chaque disposition en plus est une disposition vers laquelle Windows peut basculer.', [ps('Get-WinUserLanguageList | Select-Object LanguageTag, LocalizedName, InputMethodTips')], 'Par exemple fr-CA avec « 0C0C:00011009 », puis en-US avec « 0409:00000409 ». Plus d’une disposition au total : c’est ce qui permet le basculement involontaire.'),
      lec('Format régional et langue du système', 'Le format (dates, nombres, monnaie) de ton compte et la langue des programmes sans Unicode.', [ps('Get-Culture | Select-Object Name, DisplayName'), ps('Get-WinSystemLocale | Select-Object Name, DisplayName')], 'Par exemple fr-CA « Français (Canada) » pour les deux lignes. Des valeurs différentes expliquent des formats ou des accents mélangés.', { verification: true }),
    ],
    verification: ['Tu connais toutes les langues et dispositions installées et le format régional actif.'],
    sources: [src('Get-WinUserLanguageList', `${INTL}/get-winuserlanguagelist`), src('Get-Culture', '/powershell/module/microsoft.powershell.utility/get-culture')],
  }),
  fiche({
    id: 'win-clavier-fixer', titre: 'Garder une seule langue et un seul clavier', effet: 'modification', privileges: USER,
    resume: 'Remplace la liste des langues de ton compte par une seule, avec son clavier par défaut, pour que Windows ne bascule plus entre plusieurs dispositions. Peut être étendu à l’écran de connexion.',
    intentions: ['set-winuserlanguagelist', 'supprimer un clavier windows', 'retirer la disposition de clavier en trop', 'garder un seul clavier sous windows 11', 'copy-userinternationalsettingstosystem'],
    motsCles: ['clavier', 'langue', 'set-winuserlanguagelist', 'new-winuserlanguagelist', 'disposition', 'écran de connexion'],
    params: [LANGUE],
    etapes: [
      lec('Noter l’état actuel', 'Garde ce résultat : il sert à revenir en arrière.', [ps('Get-WinUserLanguageList | Select-Object LanguageTag, InputMethodTips')], 'La liste des langues et claviers avant le changement.'),
      mod('Ne garder que la langue voulue', 'Remplace toute la liste par une seule langue et son clavier par défaut. -Force évite la question de confirmation.', [ps('Set-WinUserLanguageList -LanguageList (New-WinUserLanguageList -Language {{langue}}) -Force')], 'Aucun message en cas de succès.', { important: 'Les autres langues et leurs claviers sont retirés de ton compte. Le clavier par défaut de la langue peut ne pas être celui que tu veux (par exemple « Canadien français (hérité) ») : vérifie à l’étape suivante.' }),
      mod('Étendre à l’écran de connexion et aux nouveaux comptes (facultatif)', 'Copie tes réglages vers l’écran de connexion : sinon ce dernier garde l’ancienne disposition. Disponible dans les versions récentes de Windows 11.', [ps('Copy-UserInternationalSettingsToSystem -WelcomeScreen $true -NewUser $true')], 'Aucun message en cas de succès. Commande inconnue : version trop ancienne, règle l’écran de connexion dans Paramètres › Heure et langue › Région › Paramètres administratifs.', { facultatif: true, important: 'Demande un PowerShell ouvert en tant qu’administrateur.' }),
      lec('Vérifier', 'Une seule langue et une seule disposition doivent rester.', [ps('Get-WinUserLanguageList | Select-Object LanguageTag, InputMethodTips')], 'Une seule ligne, avec une seule disposition.', { verification: true }),
    ],
    verification: ['Une seule langue et une seule disposition restent, et le clavier ne bascule plus après une fermeture et réouverture de session.'],
    retour: 'Paramètres › Heure et langue › Langue et région › Ajouter une langue, pour réinstaller une langue ou un clavier retiré.',
    sources: [src('Set-WinUserLanguageList', `${INTL}/set-winuserlanguagelist`), src('New-WinUserLanguageList', `${INTL}/new-winuserlanguagelist`), src('Copy-UserInternationalSettingsToSystem', `${INTL}/copy-userinternationalsettingstosystem`)],
  }),
  fiche({
    id: 'win-clavier-raccourci', titre: 'Désactiver le raccourci Alt+Maj qui change la disposition', effet: 'modification', privileges: USER,
    resume: 'Désactive les raccourcis Alt+Maj et Ctrl+Maj qui basculent la langue ou la disposition du clavier sans le vouloir. Win+Espace reste disponible.',
    intentions: ['désactiver alt shift changer de clavier', 'le clavier change quand j’appuie sur alt maj', 'keyboard layout toggle registre', 'raccourci de changement de langue windows', 'ctrl shift change la disposition'],
    motsCles: ['alt shift', 'raccourci', 'clavier', 'toggle', 'registre', 'hotkey', 'langue'],
    etapes: [
      lec('Lire le réglage actuel', '1 : Alt+Maj, 2 : Ctrl+Maj, 3 : aucun raccourci. Une valeur absente se comporte comme 1.', [ps('Get-ItemProperty -Path "HKCU:\\Keyboard Layout\\Toggle"')], 'Les valeurs Hotkey, Language Hotkey et Layout Hotkey. Une erreur « chemin introuvable » : la clé n’existe pas encore, l’étape suivante la crée.'),
      mod('Désactiver les deux raccourcis', 'Écrit « 3 » (aucun) pour le raccourci de langue et celui de disposition. New-Item crée la clé si besoin, -Force évite une erreur si elle existe.', [ps('New-Item -Path "HKCU:\\Keyboard Layout\\Toggle" -Force | Out-Null'), ps('Set-ItemProperty -Path "HKCU:\\Keyboard Layout\\Toggle" -Name "Language Hotkey" -Value "3"'), ps('Set-ItemProperty -Path "HKCU:\\Keyboard Layout\\Toggle" -Name "Layout Hotkey" -Value "3"')], 'Aucun message en cas de succès.', { important: 'Prend effet après fermeture et réouverture de session. Ne touche que ton compte.' }),
      lec('Vérifier', 'Les deux valeurs doivent valoir 3.', [ps('Get-ItemProperty -Path "HKCU:\\Keyboard Layout\\Toggle" | Select-Object "Language Hotkey", "Layout Hotkey"')], 'Language Hotkey : 3 et Layout Hotkey : 3.', { verification: true }),
    ],
    verification: ['Les deux valeurs valent 3 et Alt+Maj ne change plus la disposition après une réouverture de session.'],
    retour: 'Remets "1" dans Language Hotkey et Layout Hotkey avec Set-ItemProperty, puis rouvre la session.',
    sources: [src('Set-ItemProperty', '/powershell/module/microsoft.powershell.management/set-itemproperty'), src('Get-ItemProperty', '/powershell/module/microsoft.powershell.management/get-itemproperty')],
  }),
  fiche({
    id: 'win-region-format', titre: 'Régler le format régional et le pays (dates, nombres)', effet: 'modification', privileges: USER,
    resume: 'Règle le format régional de ton compte (dates, heure, nombres, monnaie) et le pays déclaré. Corrige des dates au mauvais format ou un point à la place de la virgule.',
    intentions: ['set-culture', 'changer le format de date windows', 'point au lieu de virgule dans excel', 'set-winhomelocation', 'format régional windows en ligne de commande'],
    motsCles: ['set-culture', 'format régional', 'date', 'virgule', 'pays', 'set-winhomelocation', 'région'],
    params: [{ ...LANGUE, id: 'langue', label: 'format régional', aide: 'fr-CA : jj/mm/aaaa avec virgule décimale. en-US : mm/jj/aaaa avec point décimal.' }],
    etapes: [
      lec('Voir le format actuel', 'Le format de ton compte et un exemple de date.', [ps('Get-Culture | Select-Object Name, DisplayName'), ps('Get-Date -Format "d"')], 'Le nom du format et la date du jour dans ce format.'),
      mod('Appliquer le format', 'Change dates, heure, nombres et monnaie pour ton compte seulement.', [ps('Set-Culture {{langue}}')], 'Aucun message en cas de succès.', { important: 'Les programmes déjà ouverts gardent l’ancien format jusqu’à leur redémarrage.' }),
      mod('Déclarer le Canada comme pays (facultatif)', '39 est le code du Canada. Il influence les services en ligne et certaines applications.', [ps('Set-WinHomeLocation -GeoId 39')], 'Aucun message en cas de succès.', { facultatif: true }),
      lec('Vérifier', 'Le format doit être celui demandé.', [ps('Get-Culture | Select-Object Name, DisplayName'), ps('Get-Date -Format "d"')], 'Le nom choisi et une date au format attendu.', { verification: true }),
    ],
    verification: ['Le format régional affiche le nom choisi et la date s’écrit dans le format attendu.'],
    retour: 'Relance Set-Culture avec l’ancien nom noté à la première étape.',
    sources: [src('Set-Culture', `${INTL}/set-culture`), src('Set-WinHomeLocation', `${INTL}/set-winhomelocation`)],
  }),
];
