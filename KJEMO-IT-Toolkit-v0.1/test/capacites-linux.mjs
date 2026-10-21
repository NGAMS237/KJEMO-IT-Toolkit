/**
 * capacites-linux.mjs — LOT 7 (25/n) · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * CE QUE LE CONTENEUR PEUT FAIRE, MESURÉ — ET CE QU'UN BANC EN FAIT
 *
 * Certains conteneurs interdisent réellement `chown` vers un autre UID : dans
 * un espace de noms utilisateur où seul l'UID du processus est projeté, la
 * commande échoue avec « Invalid argument » (EINVAL) ou « Operation not
 * permitted » (EPERM), quels que soient les droits apparents. Le banc des
 * permissions y échouait au milieu de son contrôle positif, avec un message qui
 * ressemblait à une régression de l'assistant.
 *
 * Les deux mauvaises réponses possibles :
 *
 *   1. déclarer le banc VERT parce qu'il ne peut pas tourner — une régression
 *      deviendrait invisible dans tout conteneur restreint ;
 *   2. le laisser ÉCHOUER sur une limite du conteneur — on apprend à ignorer
 *      ses échecs, et le jour où l'échec est réel, personne ne le lit.
 *
 * La bonne réponse a trois parties :
 *
 *   - une SONDE indépendante de l'assistant : un `chown` nu sur un fichier
 *     jetable, suivi d'un `stat` qui relit le propriétaire. C'est la capacité
 *     qui est mesurée, pas l'outil testé ;
 *   - si la sonde dit « absente », le banc annonce NON EXÉCUTÉ, avec la raison
 *     exacte, et sort avec un code DISTINCT (77) — jamais 0 ;
 *   - si la sonde dit « présente », le banc s'exécute, et toute anomalie est un
 *     ÉCHEC. Un chown qui échoue ALORS QUE la sonde a réussi est une
 *     régression, pas une limite.
 *
 * Un environnement qui POSSÈDE la capacité peut en outre l'EXIGER, en posant
 * KJEMO_CAPACITES_REQUISES=1 (la CI le fait) : l'absence devient alors un
 * ÉCHEC. Sans cette exigence, un runner dégradé en silence rendrait le banc
 * « non exécuté » à chaque passage, sans que personne ne s'en aperçoive.
 *
 * Ce module n'est pas un banc. Il est éprouvé par test/capacites-linux.test.mjs.
 */
import { mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Code de sortie de « NON EXÉCUTÉ » : ni 0 (succès), ni 1 (échec). Convention « skip » d'automake. */
export const CODE_NON_EXECUTE = 77;

/** Messages que produit un chown refusé par le noyau, sans que l'outil testé y soit pour rien. */
const REFUS_SYSTEME = /Invalid argument|Operation not permitted|Permission denied/i;

/**
 * Mesure la capacité de `chown` vers un autre compte, sur un fichier jetable.
 *
 * @returns {{etat: 'PRESENTE'|'ABSENTE'|'INDETERMINEE', raison: string}}
 *   INDETERMINEE = la sonde ne sait pas conclure. Ce n'est PAS « absente » :
 *   un échec qu'on ne sait pas classer est traité comme un échec.
 */
export function sonderChown({ compte, groupe, uidAttendu, env = process.env } = {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'kjemo-sonde-chown-'));
  try {
    const fichier = join(dossier, 'sonde');
    writeFileSync(fichier, 'sonde\n', 'utf8');
    try {
      execFileSync('chown', ['--no-dereference', `${compte}:${groupe}`, fichier], {
        env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
      });
    } catch (e) {
      if (e.code === 'ENOENT') {
        return { etat: 'INDETERMINEE', raison: 'la commande chown est introuvable dans le PATH' };
      }
      const msg = `${e.stderr ?? ''}${e.stdout ?? ''}`.trim();
      if (REFUS_SYSTEME.test(msg)) {
        return { etat: 'ABSENTE', raison: `chown ${compte}:${groupe} refuse par le systeme : « ${msg} »` };
      }
      return { etat: 'INDETERMINEE', raison: `chown a echoue pour une raison non classee : « ${msg || e.message} »` };
    }
    // Code 0 ne suffit pas : on relit le proprietaire. Un chown « reussi » qui
    // ne change rien (systeme de fichiers qui ignore le proprietaire) rendrait
    // le controle positif du banc faux.
    const uid = statSync(fichier).uid;
    if (Number.isFinite(uidAttendu) && uid !== uidAttendu) {
      return { etat: 'INDETERMINEE',
        raison: `chown a rendu 0 mais le proprietaire est ${uid}, et non ${uidAttendu}` };
    }
    return { etat: 'PRESENTE', raison: `chown ${compte}:${groupe} accepte et relu (uid ${uid})` };
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/**
 * Décide ce que le banc fait de la mesure.
 *
 * @returns {{verdict: 'EXECUTER'|'NON_EXECUTE'|'ECHEC', raison: string}}
 */
export function decider(sonde, env = process.env) {
  if (sonde.etat === 'PRESENTE') {
    return { verdict: 'EXECUTER', raison: sonde.raison };
  }
  if (sonde.etat === 'ABSENTE') {
    if (env.KJEMO_CAPACITES_REQUISES === '1') {
      return { verdict: 'ECHEC',
        raison: `capacite EXIGEE par l'environnement (KJEMO_CAPACITES_REQUISES=1) mais absente : ${sonde.raison}` };
    }
    return { verdict: 'NON_EXECUTE', raison: sonde.raison };
  }
  return { verdict: 'ECHEC', raison: `capacite indeterminee, traitee comme un echec : ${sonde.raison}` };
}
