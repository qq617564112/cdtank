import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {encodeRoleAmmoChange, decodeRoleAmmoChange, receiveRoleAmmoChange, ROLE_AMMO_CHANGE_MESSAGE_TYPE} from '../recovery/evidence/roles/role-ammo-change-wire';
interface State {seconds: number; deadline: number}
interface Event {kind: string; value?: number; state?: State}
const evidence: {messageType: number; constructorLeavesBodyUninitialized: boolean;
  wireRows: {field0c: number; field10: number; seconds: number; offset: number;
    payload: string; result: State; events: Event[]}[]} = JSON.parse(readFileSync('recovery/output/role-ammo-change-native.json', 'utf8'));
assert.equal(ROLE_AMMO_CHANGE_MESSAGE_TYPE, evidence.messageType);
assert.equal(evidence.constructorLeavesBodyUninitialized, true);
for (const row of evidence.wireRows) {
  const packet = {field0c: row.field0c, field10: row.field10, seconds: row.seconds};
  const bytes = Buffer.from(row.payload, 'hex');
  assert.equal(Buffer.from(encodeRoleAmmoChange(packet, row.offset)).toString('hex'), row.payload);
  assert.deepEqual(decodeRoleAmmoChange(bytes, row.offset), packet);
  const role = createRoleCombatState();
  role.roleFloatFields.set(0x54, 9.25);
  role.nextAvailableSeconds = 7.25;
  const state = (): State => ({seconds: role.roleFloatFields.get(0x54)!, deadline: role.nextAvailableSeconds});
  const beforeRecord = [...role.record!.numericFields!];
  const events: Event[] = [];
  assert.deepEqual(receiveRoleAmmoChange(bytes, role, () => {
    events.push({kind: 'clock', state: state()}); return 123.456789;
  }, {
    ammoChanged: value => events.push({kind: 'changed', value, state: state()}),
    duration: value => events.push({kind: 'duration', value, state: state()}),
  }, row.offset), packet);
  assert.deepEqual(state(), row.result);
  assert.deepEqual(events, row.events);
  assert.deepEqual([...role.record!.numericFields!], beforeRecord);
}
console.log(`PASS: ${evidence.wireRows.length} original3ab5 96-bit codec/actual-role confirmation chains at all8 alignments`);
