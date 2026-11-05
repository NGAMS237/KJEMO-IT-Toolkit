/**
 * procedures-cours.mjs — KJEMO-COMMANDES-COURS-TP2-01 · KJEMO IT Toolkit
 * ---------------------------------------------------------------------------
 * Les fiches rédigées à partir des notes de cours (Serveurs II — TP2), toutes
 * à la main. Même contrat que les autres procédures (voir procedures.mjs) :
 * rien n'est généré automatiquement, rien n'est exécuté par le Toolkit.
 */
import { COURS_BASES } from './cours-fiches-bases.mjs';
import { COURS_STOCKAGE } from './cours-fiches-stockage.mjs';
import { COURS_SAMBA } from './cours-fiches-samba.mjs';
import { COURS_CLIENTS } from './cours-fiches-clients.mjs';
import { COURS_MEMO } from './cours-fiches-memo.mjs';
import { COURS_FORMATIFS } from './cours-fiches-formatifs.mjs';
import { COURS_CISCO } from './cours-fiches-cisco.mjs';
import { COURS_AZURE } from './cours-fiches-azure.mjs';
import { COURS_CISCO_RESEAU } from './cours-fiches-cisco-reseau.mjs';
import { COURS_CISCO_S09 } from './cours-fiches-cisco-s09.mjs';
import { COURS_CISCO_NAT } from './cours-fiches-cisco-nat.mjs';
import { COURS_CISCO_SHOW } from './cours-fiches-cisco-show.mjs';
import { COURS_CISCO_TP_VLAN } from './cours-fiches-cisco-tp-vlan.mjs';

export const PROCEDURES_COURS = [...COURS_BASES, ...COURS_STOCKAGE, ...COURS_SAMBA, ...COURS_CLIENTS, ...COURS_MEMO, ...COURS_FORMATIFS, ...COURS_CISCO, ...COURS_CISCO_RESEAU, ...COURS_CISCO_S09, ...COURS_CISCO_NAT, ...COURS_CISCO_SHOW, ...COURS_CISCO_TP_VLAN, ...COURS_AZURE];
