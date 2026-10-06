import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BattleItemRecord} from '../apps/shared/combat/item-hotkeys';
import {requestRoleAmmoSelection} from '../apps/server/src/battle/items/role-ammo-request';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';

interface Gate {
  slot: number; tableId: number; group: number | null; quantity: number;
  instance: number; duplicateTable: number | null; sent: boolean;
}
const evidence: {gates: Gate[]; rows: {present: boolean; status: 0 | 1 | 2 | 3;
  selection: number; events: {slot: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-ammo-request-native.json', 'utf8'));
for (const row of evidence.rows) {
  const role = createRoleCombatState();
  role.record!.status = row.status;
  role.record!.numericFields!.set(0x3c, row.selection);
  const sent: number[] = [];
  requestRoleAmmoSelection(row.present ? role : undefined,
    {primary: [], secondary: []}, 1, slot => sent.push(slot));
  assert.deepEqual(sent, row.events.map(event => event.slot));
  assert.equal(role.selectedAmmoSlot, row.selection);
}
for (const row of evidence.gates) {
  const role = createRoleCombatState();
  role.record!.status = 2;
  role.record!.numericFields!.set(0x3c, row.slot);
  const hotkeys = role.record!.arrays.get(0)!;
  if (row.slot >= 2 && row.slot <= 8) hotkeys[row.slot - 2] = row.instance;
  const record = (tableId: number): BattleItemRecord => ({instanceId: row.instance,
    itemTableId: tableId, ownedQuantity: 91, battleQuantity: row.quantity});
  const inventory = {primary: row.group === 0 ? [record(row.tableId)] : [],
    secondary: row.group === 1 ? [record(row.tableId)] : []};
  if (row.duplicateTable !== null) inventory.secondary.push(record(row.duplicateTable));
  const beforeInventory = structuredClone(inventory);
  const beforeNumeric = [...role.record!.numericFields!];
  const beforeFlags = [...role.record!.flags];
  const sent: number[] = [];
  requestRoleAmmoSelection(role, inventory, row.slot, slot => sent.push(slot));
  assert.deepEqual(sent, row.sent ? [row.slot] : [], JSON.stringify(row));
  assert.deepEqual(inventory, beforeInventory);
  assert.deepEqual([...role.record!.numericFields!], beforeNumeric);
  assert.deepEqual([...role.record!.flags], beforeFlags);
}
console.log(`PASS: ${evidence.rows.length} role/status/repeated-selection gates and ${evidence.gates.length} original inventory/classification requests without state mutation`);
