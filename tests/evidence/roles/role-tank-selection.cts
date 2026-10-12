import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestRoleTankSelection} from './role-tank-selection';
const evidence: {rows: {instanceId: number; sameRecord: boolean;
  sameInstanceDifferentRecord: boolean; sent: number[]; wire: number[]}[]} = JSON.parse(
  readFileSync('recovery/output/role-tank-selection-native.json', 'utf8'));
for (const row of evidence.rows) {
  const selected = {name: 'Selected', fields: new Map([[0x1c, row.instanceId]])};
  const current = row.sameRecord ? selected : row.sameInstanceDifferentRecord ?
    {name: 'Other object', fields: new Map(selected.fields)} : undefined;
  const sent: number[] = [];
  assert.equal(requestRoleTankSelection(selected, current, id => sent.push(id)), !row.sameRecord);
  assert.deepEqual(sent, row.sent);
  assert.deepEqual([...selected.fields], [[0x1c, row.instanceId]]);
  assert.deepEqual(row.wire, [row.instanceId]);
}
console.log(`PASS: ${evidence.rows.length} native tank selection requests, reference comparison and source preservation`);
