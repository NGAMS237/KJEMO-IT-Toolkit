/**
 * sources-cisco.mjs — RESEAU-CISCO-01
 * Sources officielles Cisco citées par les assistants. Toutes sont des pages
 * PRÉCISES de cisco.com. Documentation du Catalyst 1000 (IOS 15.2(7)Ex) quand
 * elle existe, parce que c'est le matériel de référence du lot — cela ne veut
 * pas dire que les commandes ont été essayées sur ce matériel.
 * Existence des pages : vérifiée en ligne par test/sources-cisco.mjs.
 */
const C1000 = 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst1000/software/releases/15_2_7_e';

export const SRC = {
  cli: { label: 'Cisco — Utiliser la ligne de commande (Catalyst 2960, IOS 12.2(55)SE)', url: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960/software/release/12-2_55_se/configuration/guide/scg_2960/swcli.html' },
  systeme: { label: 'Catalyst 1000 — Administering the System', url: `${C1000}/configuration_guides/sys_mgmt/b_1527e_sys_mgmt_c1000_cg/administering_the_system.html` },
  interfaces: { label: 'Catalyst 1000 — Configuring Interface Characteristics', url: `${C1000}/configuration_guides/int_hw/b_1527e_int_and_hw_c1000_cg/configuring_interface_characteristics.html` },
  ssh: { label: 'Catalyst 1000 — Configuring Secure Shell', url: `${C1000}/configuration_guides/sec/b_1527e_security_c1000_cg/configuring_ssh.html` },
  portSecurity: { label: 'Catalyst 1000 — Port Security', url: `${C1000}/configuration_guides/sec/b_1527e_security_c1000_cg/port_security.html` },
  vlan: { label: 'Catalyst 1000 — Configuring VLAN', url: `${C1000}/configuration_guides/vlan/b_1527e_vlan_c1000_cg/configuring_vlan.html` },
  trunks: { label: 'Catalyst 1000 — Configuring VLAN Trunks (dont DTP)', url: `${C1000}/configuration_guides/vlan/b_1527e_vlan_c1000_cg/configuring_vlan_trunks.html` },
  vlanCommandes: { label: 'Catalyst 1000 — Command Reference : VLAN', url: `${C1000}/command_reference/b_1527e_1000_cr/vlan_commands.html` },
  layer2Commandes: { label: 'Catalyst 1000 — Command Reference : Layer 2', url: `${C1000}/command_reference/b_1527e_1000_cr/layer_2_commands.html` },
  vtpTechnote: { label: 'Cisco — Configure VTP on Catalyst Switches', url: 'https://www.cisco.com/c/en/us/support/docs/lan-switching/vtp/98154-conf-vlan.html' },
  vtp2960l: { label: 'Catalyst 2960-L (IOS 15.2(7)E) — Configuring VTP', url: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst2960l/software/15-2_7_e/configuration_guide/vlan/b_1527e_vlan_2960l_cg/m_vlan_vtp_cg.html' },
  vtp3850: { label: 'Cisco — Configuring VTP (précautions sur les révisions v1/v2)', url: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3850/software/release/3se/vlan/configuration_guide/b_vlan_3se_3850_cg/b_vlan_3se_3850_cg_chapter_011.html' },
};
export const toutesLesSources = () => Object.values(SRC);
