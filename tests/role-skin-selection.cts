import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receiveRoleArrayProperties} from '../recovery/evidence/combat/role-array-property';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';

const original = JSON.parse(readFileSync('recovery/output/role-skin-selection-sol-native.json', 'utf8'));
for (const row of original.receivedRows) {
  const wire = Uint8Array.from(row.wire);
  // Actual52a280 body: fixed role header followed by the declared property segment.
  const segment = wire.slice(32);
  assert.equal(segment[0], 4);
  assert.equal(segment[1], 32);
  const bytes = new Uint8Array(12).fill(0xa5);
  const snapshot = new Uint8Array(12).fill(0x55);
  const field = {width: 4 as const, count: 3, bytes, snapshot};
  const values = () => Array.from({length: 3}, (_, slot) => new DataView(bytes.buffer).getUint32(slot * 4, true));
  const events: unknown[] = [];
  assert(receiveRoleArrayProperties(new Map([[32, field]]), [segment], 0x11223344,
    (index, context) => events.push({index, context, texture: values()})));
  assert.deepEqual(values(), row.getter);
  assert.deepEqual(events, row.events);
  assert(snapshot.every(value => value === 0x55));
}
const state = createRoleCombatState();
const before = state.dirty;
assert.equal(state.setArray(3, [10011, 10012, 10013]), false);
assert.equal(state.dirty, before);
console.log(`PASS: ${original.receivedRows.length} original skin property32 messages match shared unsigned receive/notification; setter3 remains unsupported`);
