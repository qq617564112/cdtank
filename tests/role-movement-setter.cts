import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setRoleMovementProperty} from '../apps/server/src/battle/roles/movement-setter';
const evidence: {rows: {present: boolean; selector: 10 | 11; value: number; dirty: number; returned: boolean;
  result: {move: number; turn: number}; events: {index: number; state: {move: number; turn: number}; dirty: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-movement-setter-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = {move: 17.25, turn: 3.125};
  const events: typeof row.events = [];
  const returned = setRoleMovementProperty(row.present ? record : undefined, row.selector, row.value,
    index => events.push({index, state: {...record}, dirty: row.dirty}));
  assert.equal(returned, row.returned);
  assert.deepEqual(record, row.result);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${evidence.rows.length} original movement setter contracts`);
