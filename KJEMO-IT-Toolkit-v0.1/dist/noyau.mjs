/**
 * noyau.mjs — LOT 2 · KJEMO IT Toolkit
 * -------------------------------------------
 * Deux fonctions, et rien d'autre : l'encodage Base64 des valeurs utilisateur,
 * et la garde de validation appelée par chaque generate().
 *
 * Pourquoi un fichier séparé ? Le catalogue Windows Server du LOT 2 vit dans
 * son propre module, et generators.mjs y importe ses outils. Si ce module
 * importait à son tour psB64 depuis generators.mjs, les deux fichiers
 * s'importeraient mutuellement. Un cycle ESM fonctionne souvent, échoue
 * parfois, et se diagnostique mal. Les deux fonctions vivent donc ici, sans
 * aucune dépendance, et generators.mjs les ré-exporte : rien ne change pour
 * les importateurs existants.
 *
 * Le comportement est identique au LOT 0, à la ligne près. Les 64 scripts
 * historiques restent octet pour octet les mêmes, ce que vérifie
 * test/scripts-baseline.json.
 */

/**
 * Encode une valeur utilisateur en expression PowerShell Base64 UTF-8.
 * Cette représentation préserve exactement tous les points de code Unicode :
 *   U+2018 ('), U+2019 ('), accents, $, backtick, guillemets, retours à la ligne, etc.
 *
 * Exemple d'expression générée :
 *   [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('T2...'))
 *
 * PowerShell traite U+2018, U+2019, U+201C et U+201D comme des délimiteurs de
 * chaîne : une apostrophe typographique collée telle quelle dans un script
 * casse l'analyse syntaxique. D'où cet encodage, pour TOUTE valeur saisie.
 */
export function psB64(v) {
  const bytes = new TextEncoder().encode(String(v ?? ''));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}'))`;
}

/**
 * assertValid : appelle tool.validate(v) et lève une exception si la moindre
 * erreur est détectée. Appelé par chaque generate() : aucun script n'est
 * produit à partir de données invalides, y compris hors navigateur.
 *
 * @param {object} tool   - l'objet outil (doit avoir une méthode validate)
 * @param {object} v      - les valeurs à valider
 */
export function assertValid(tool, v) {
  const errors = tool.validate(v);
  const keys = Object.keys(errors);
  if (keys.length > 0) {
    const msgs = keys.map((k) => `${k} : ${errors[k]}`).join(' | ');
    throw new Error(`Entrée invalide — ${msgs}`);
  }
}
