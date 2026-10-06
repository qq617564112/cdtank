import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receiveRoleAmmoChangeEnvelope} from '../recovery/evidence/roles/role-ammo-change-wire';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';

interface State {seconds: number; deadline: number}
interface Row {
  identity: number; field0c: number; field10: number; seconds: number;
  payload: string; bitsRead: number; result: State;
  events: {kind: string; state?: State}[];
}
const evidence: {status: string; registrationCounts: number[]; rows: Row[]} =
  JSON.parse(readFileSync('recovery/output/role-ammo-receive-chain-native.json', 'utf8'));
assert.equal(evidence.status, 'PASS');
assert.deepEqual(evidence.registrationCounts, [23, 23, 23]);
for (const row of evidence.rows) {
  const role = createRoleCombatState();
  role.roleFloatFields.set(0x54, 9.25);
  role.nextAvailableSeconds = 7.25;
  const state = (): State => ({seconds: role.roleFloatFields.get(0x54)!, deadline: role.nextAvailableSeconds});
  const recordBefore = [...role.record!.numericFields!];
  const payload = Buffer.from(row.payload, 'hex');
  const events: {kind: string; state: State}[] = [];
  const result = receiveRoleAmmoChangeEnvelope(payload, role, () => {
    events.push({kind: 'clock', state: state()}); return 123.456789;
  }, {});
  assert.deepEqual(result, {identity: row.identity,
    packet: {field0c: row.field0c, field10: row.field10, seconds: row.seconds}});
  assert.deepEqual(state(), row.result);
  assert.deepEqual(events, row.events.filter(event => event.kind === 'clock'));
  assert.deepEqual([...role.record!.numericFields!], recordBefore);
  assert.equal(row.bitsRead, 128);
  const before = state();
  for (const invalid of [payload.subarray(0, 3), payload.subarray(0, 12),
    Buffer.concat([Buffer.from([0x92, 0x3c]), payload.subarray(2)])]) {
    assert.throws(() => receiveRoleAmmoChangeEnvelope(invalid, role,
      () => {throw new Error('Malformed envelope called the clock');}, {}), RangeError);
    assert.deepEqual(state(), before);
  }
}
console.log(`PASS: ${evidence.rows.length} original server-envelope/identity/role confirmation chains; invalid envelopes rejected before mutation`);
