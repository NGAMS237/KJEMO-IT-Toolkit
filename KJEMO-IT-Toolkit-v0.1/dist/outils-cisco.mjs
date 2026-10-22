/** outils-cisco.mjs — RESEAU-CISCO-01 : les 19 assistants (socle + VLAN/trunks/DTP/VTP). */
import { toolsCiscoSocle } from './outils-cisco-socle.mjs';
import { toolsCiscoVlan } from './outils-cisco-vlan.mjs';

export const toolsCisco = [...toolsCiscoSocle, ...toolsCiscoVlan];
