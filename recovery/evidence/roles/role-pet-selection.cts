import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestRolePetSelection} from './role-pet-selection';
const evidence: {rows: {instanceId: number; sameRecord: boolean;
  sameInstanceDifferentRecord: boolean; sent: number[]; wire: number[]; hint: boolean; hints: number[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-pet-selection-native.json', 'utf8'));
for (const row of evidence.rows) {
  const selected = {name: 'Selected', fields: new Map([[0, row.instanceId]])};
  const current = row.sameRecord ? selected : row.sameInstanceDifferentRecord ?
    {name: 'Other object', fields: new Map(selected.fields)} : undefined;
  const sent: number[] = [], hints: number[] = [];
  const order: string[] = [];
  assert.equal(requestRolePetSelection(selected, current, row.hint,
    id => {sent.push(id); order.push('send');}, () => {hints.push(2); order.push('hint');}), !row.sameRecord);
  assert.deepEqual(sent, row.sent);
  assert.deepEqual(hints, row.hints);
  assert.deepEqual(order, row.sameRecord ? [] : row.hint ? ['hint', 'send'] : ['send']);
  assert.deepEqual([...selected.fields], [[0, row.instanceId]]);
  assert.deepEqual(row.wire, [row.instanceId]);
}
console.log(`PASS: ${evidence.rows.length} native pet selection requests and local hint order`);
