import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveRoleItemInstance} from '../recovery/evidence/combat/role-item-resolver';
import type {BattleItemRecord} from '../apps/shared/combat/item-hotkeys';

const evidence: {rows: {tableId: number; instanceId: number; group: number;
  tableFound: boolean; result: boolean; lookups: number[]}[]; duplicateFirstTableId: number} =
  JSON.parse(readFileSync('recovery/output/role-item-resolver-native.json', 'utf8'));
const record = (instanceId: number, itemTableId: number): BattleItemRecord =>
  ({instanceId, itemTableId, ownedQuantity: 1, battleQuantity: 1});
for (const row of evidence.rows) {
  const groups = Array.from({length: 8}, () => [] as BattleItemRecord[]);
  groups[row.group].push(record(row.instanceId, row.tableId));
  const calls: number[] = [];
  const table = {id: row.tableId};
  const result = resolveRoleItemInstance(groups, row.instanceId, id => {
    calls.push(id);
    return row.tableFound ? table : undefined;
  });
  assert.equal(result !== undefined, row.result);
  if (result) assert.strictEqual(result, table);
  assert.deepEqual(calls, row.lookups);
}
const groups = Array.from({length: 8}, (_, index) => [record(73, 100 + index)]);
assert.equal(resolveRoleItemInstance(groups, 73, id => id), evidence.duplicateFirstTableId);
assert.equal(resolveRoleItemInstance(groups, 74, id => id), undefined);
console.log(`PASS: ${evidence.rows.length} native role item instance/table resolution contracts`);
