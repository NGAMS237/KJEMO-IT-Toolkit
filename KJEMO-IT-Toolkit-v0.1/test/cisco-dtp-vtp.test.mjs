/**
 * cisco-dtp-vtp.test.mjs — Formatif 06 (VTP et DTP) : le générateur de config IOS du labo écrit
 * « switchport mode dynamic desirable | auto », le serveur et les clients VTP, et propose show vtp status.
 * Aucun mot de passe VTP n'est généré ni accepté (il se tape à la main dans le terminal).
 */
import * as K from '../dist/config-ios.mjs';

let ok = 0; let ko = 0;
const assert = (c, m, d = '') => { if (c) ok += 1; else { ko += 1; console.log(`  [FAIL]  ${m}${d ? ` — ${d}` : ''}`); } };
const noeud = (modele = 'c2960-24tt') => ({ id: 'n1', type: 'commutateur', nom: 'DS1', modele });

const ds1 = K.normaliserConfig({ nomHote: 'DS1', vtp: { mode: 'server', domaine: 'CCNA-LAB' }, vlans: [10, 20, 30, 40, 50].map((id) => ({ id: String(id), nom: `VLAN${id}` })),
  ports: { 'FastEthernet0/7': { mode: 'desirable' }, 'FastEthernet0/9': { mode: 'desirable' }, 'FastEthernet0/11': { mode: 'auto' } } });
assert(ds1.ports['FastEthernet0/7']?.mode === 'desirable' && ds1.ports['FastEthernet0/11']?.mode === 'auto', 'modes DTP desirable et auto conservés');
const txt = K.texteCommandes(K.commandesIos(noeud(), ds1));
assert(/interface FastEthernet0\/7\n.*switchport mode dynamic desirable/s.test(txt), 'F0/7 : switchport mode dynamic desirable', txt);
assert(/interface FastEthernet0\/9[^!]*switchport mode dynamic desirable/s.test(txt), 'F0/9 : switchport mode dynamic desirable');
assert(/switchport mode dynamic auto/.test(txt), 'mode dynamic auto');
assert(/vtp mode server/.test(txt) && /vtp domain CCNA-LAB/.test(txt), 'DS1 : serveur VTP, domaine CCNA-LAB');
assert(/vlan 10\b/.test(txt) && /vlan 50\b/.test(txt), 'les cinq VLAN 10 à 50');
assert(!/vtp password/.test(txt), 'aucun mot de passe VTP généré');

const cl = K.normaliserConfig({ nomHote: 'AS1', vtp: { mode: 'client', domaine: 'CCNA-LAB' } });
const tc = K.texteCommandes(K.commandesIos(noeud(), cl));
assert(/vtp mode client/.test(tc) && /vtp domain CCNA-LAB/.test(tc), 'AS1 : client VTP du domaine');

const tests = K.testsProposes(noeud(), ds1, 'DS1').map((t) => t.test);
assert(tests.some((t) => /show interfaces trunk/.test(t)) && tests.some((t) => /show vtp status/.test(t)), 'vérifications : show interfaces trunk et show vtp status', tests.join(' | '));
const tcl = K.testsProposes(noeud(), cl, 'AS1');
assert(tcl.some((t) => /show vtp status/.test(t.test) && /client/.test(t.attendu)), 'client : show vtp status attend le mode client');
assert(!K.testsProposes(noeud(), K.normaliserConfig({ nomHote: 'X' }), 'X').some((t) => /vtp/.test(t.test)), 'sans VTP : pas de vérification VTP');

const t35 = K.texteCommandes(K.commandesIos(noeud('3560-24ps'), K.normaliserConfig({ ports: { 'FastEthernet0/1': { mode: 'desirable' } } })));
assert(/switchport trunk encapsulation dot1q\n.*switchport mode dynamic desirable/s.test(t35), '3560 : encapsulation dot1q avant le mode dynamique');

const rt = K.verifierConfig({ id: 'r', type: 'routeur', nom: 'R1' }, K.normaliserConfig({ ports: { 'GigabitEthernet0/0': { mode: 'auto' } } }));
assert(rt.some((m) => /DTP/.test(m)), 'routeur : avertissement DTP', rt.join(' | '));
const tw = K.normaliserConfig({ vtp: { mode: 'client', domaine: 'CCNA-LAB', motDePasse: 'x1' } });
assert(!('motDePasse' in tw.vtp) && !JSON.stringify(tw).includes('x1'), 'un mot de passe VTP fourni est écarté par la normalisation');

console.log(`cisco-dtp-vtp : ${ok} vérification(s) réussie(s), ${ko} échec(s).`);
process.exit(ko ? 1 : 0);
