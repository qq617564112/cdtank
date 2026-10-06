import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeRoleNumericProperty, receiveRoleNumericProperties} from '../recovery/evidence/roles/role-numeric-property';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {readRoleNetworkMessage} from '../recovery/evidence/combat/role-network-message';
import {routeRolePropertyMessage} from '../recovery/evidence/combat/role-property-route';
import {applyRoleFireReloadNotification} from '../apps/server/src/battle/roles/reload';

interface State {bullet: number; maximum: number; hp: number; maxHp: number}
interface Event extends State {index: number; context: number}
const evidence: {
  bulletWireRows: {index: 5 | 8; bits: number; bytes: number[]}[];
  bulletReceiveRows: {observer: boolean; raw: number[]; segments: number[][];
    handled: boolean; accepted: boolean | null; result: State; events: Event[]; pending: number[]}[];
} = JSON.parse(readFileSync('recovery/output/role-properties-native.json', 'utf8'));
for (const row of evidence.bulletWireRows) {
  assert.deepEqual([...encodeRoleNumericProperty(row.index, row.bits)], row.bytes);
}
for (const row of evidence.bulletReceiveRows) {
  const record = createRoleCombatState().record!;
  record.numericFields!.set(0x44, 5);
  record.numericFields!.set(0x38, 3);
  record.numericFields!.set(0x54, 37);
  record.numericFields!.set(0x58, 200);
  const pending = new Uint32Array(row.pending);
  const role = new RoleCombatState(record, () => assert.fail('received property emitted outgoing notification'));
  role.dirty = false;
  const state = (): State => ({bullet: role.bulletCount, maximum: role.maxBulletCount,
    hp: record.numericFields!.get(0x54)!, maxHp: record.numericFields!.get(0x58)!});
  const events: Event[] = [];
  const message = readRoleNetworkMessage(Uint8Array.from(row.raw));
  const segments: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < message.propertyCount; i++) {
    const payload = message.payload;
    const length = new DataView(payload.buffer, payload.byteOffset + offset, 4).getUint16(2);
    segments.push(payload.subarray(offset, offset + 4 + length));
    offset += 4 + length;
  }
  let accepted: boolean | null = null;
  const handled = routeRolePropertyMessage(73, message.objectId, message.command, {
    command3: () => assert.fail('unexpected create'),
    commands6To9: () => assert.fail('unexpected command'),
    properties: () => {
      accepted = receiveRoleNumericProperties(role.record!.numericFields!, segments, message.context,
        row.observer ? (index, context) => events.push({index, context, ...state()}) : undefined);
    },
  });
  assert.equal(handled, row.handled);
  assert.equal(accepted, row.accepted);
  assert.deepEqual(state(), row.result);
  assert.equal(record.numericFields!.get(0x38), row.result.maximum | 0);
  assert.deepEqual(events, row.events);
  assert.deepEqual([...pending], row.pending);
  assert.equal(role.dirty, false);
  const deadline = {nextAvailableSeconds: 0};
  applyRoleFireReloadNotification({local: true, bulletCount: role.bulletCount,
    normalSeconds: 1, lastBulletSeconds: 3, currentSeconds: () => .5}, deadline, {forwarded: () => {}});
  assert.equal(deadline.nextAvailableSeconds, row.result.bullet === 1 ? 3.5 : 1.5);
}
assert.equal(new RoleCombatState(undefined).record, undefined);
console.log(`PASS: ${evidence.bulletWireRows.length} native current/max encodings, ${evidence.bulletReceiveRows.length} object routes, partial writes, observer order and received bullet/reload composition`);
