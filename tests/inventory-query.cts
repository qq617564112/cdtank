import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyInventoryQuery, type InventoryItemRecord} from '../apps/shared/combat/inventory-query';
import {applyKitbagDeletion} from '../recovery/evidence/inventory/inventory-notifications';
import {initializeBattleQuantities, resolveItemHotkey} from '../apps/shared/combat/item-hotkeys';

interface QueryRow {
  rolePresent: boolean;
  zeroOwned: boolean;
  bindings: {44?: number; 45?: number; array1: number[]; array2: number[]};
  result: {groups: number[][]; states: number[]; warnings: number[]};
}
const evidence: {records: InventoryItemRecord[]; rows: QueryRow[]} = JSON.parse(readFileSync(
  'recovery/output/inventory-query-native.json', 'utf8'));
for (const row of evidence.rows) {
  const records = structuredClone(evidence.records);
  if (row.zeroOwned) {
    records[0].ownedQuantity = 0;
    records[1].ownedQuantity = 0;
  }
  const before = structuredClone(records);
  const groups = Array.from({length: 8}, () => [records[0]]);
  const warnings: number[] = [];
  applyInventoryQuery(groups, records, row.rolePresent ? {
    field44: row.bindings[44] ?? 0, field45: row.bindings[45] ?? 0,
    array1: row.bindings.array1, array2: row.bindings.array2,
  } : undefined, () => {
    assert(records.every(record => record.state === 0), 'Warning precedes equipment marking');
    warnings.push(0x36c);
  });
  assert.deepEqual(groups.map(group => group.map(record => record.instanceId)), row.result.groups);
  assert.deepEqual(records.map(record => record.state), row.result.states);
  assert.deepEqual(warnings, row.result.warnings);
  assert.deepEqual(records.map(record => [record.ownedQuantity, record.battleQuantity]),
    before.map(record => [record.ownedQuantity, record.battleQuantity]));
}

// Compose the recovered supply, shortcut and later-notification boundaries.
const records = structuredClone(evidence.records);
const groups: InventoryItemRecord[][] = Array.from({length: 8}, () => []);
applyInventoryQuery(groups, records, {field44: 0, field45: 0,
  array1: [0, 0, 0], array2: [0, 0, 0, 0, 0]});
const consumable = groups[0][0];
const hotkeys = [0, 0, 0, consumable.instanceId, 0, 0, 0];
const kitbagRecords = [...groups[0], ...groups[1]];
initializeBattleQuantities(hotkeys, kitbagRecords, () => 1);
assert.equal(consumable.battleQuantity, 1);
assert.deepEqual(resolveItemHotkey(5, true, hotkeys, kitbagRecords),
  {accepted: true, command: {kind: 'useItem', instanceId: consumable.instanceId}});
assert.equal(consumable.battleQuantity, 1, 'Use request dispatch does not consume a record');
const owned = consumable.ownedQuantity;
applyKitbagDeletion({primary: groups[0], secondary: groups[1]}, consumable.instanceId);
assert.equal(consumable.ownedQuantity, owned - 1);
assert.deepEqual(resolveItemHotkey(5, true, hotkeys, kitbagRecords),
  {accepted: false, command: {kind: 'empty', messageId: 28}});
assert.equal(hotkeys[3], consumable.instanceId, 'The notification does not clear an assigned shortcut');
console.log(`PASS: ${evidence.rows.length} native inventory queries with ${records.length} records, classifications/equipment/warning, composed supply-shortcut-notification state`);
