import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {markRolePropertyDirty} from '../apps/server/src/battle/roles/property-dirty';
const evidence: {rows: {selector: number; present: boolean; dirty: number; flag: number;
  previous: number; value: number; accepted: boolean; selection: number; tableId: number;
  specialFlag12: number; pending: number[]; getters: number[];
  events: {index: number; selection: number; tableId: number; specialFlag12: number; dirty: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-ammo-selection-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = createRoleCombatState().record!;
  record.numericFields!.set(row.selector === 11 ? 0x3c : 0x40, row.previous);
  const events: typeof row.events = [], pending = new Uint32Array(8);
  const role = new RoleCombatState(row.present ? record : undefined, index => {
    events.push({index, selection: role.selectedAmmoSlot, tableId: role.currentAmmoTableId,
      specialFlag12: role.specialFlag12, dirty: Number(role.dirty)});
    markRolePropertyDirty(pending, index);
  });
  role.dirty = row.dirty !== 0;
  role.specialFlag12 = row.flag;
  const accepted = row.selector === 11 ? role.setSelectedAmmoSlot(row.value) : role.setCurrentAmmoTableId(row.value);
  assert.equal(accepted, row.accepted);
  assert.equal(record.numericFields!.get(0x3c), row.selection);
  assert.equal(record.numericFields!.get(0x40), row.tableId);
  assert.equal(role.selectedAmmoSlot, row.present ? row.selection : 0);
  assert.equal(role.currentAmmoTableId, row.present ? row.tableId : 0);
  assert.equal(role.specialFlag12, row.specialFlag12);
  assert.equal(role.dirty, row.dirty !== 0);
  assert.deepEqual(events, row.events);
  assert.deepEqual([...pending], row.pending);
}
const incomplete = new RoleCombatState({status: 0, flags: new Uint8Array(16), arrays: new Map()});
assert.equal(incomplete.setSelectedAmmoSlot(1), false);
assert.equal(incomplete.setCurrentAmmoTableId(2001), false);
console.log(`PASS: ${evidence.rows.length} original selection/table assignments, notification timing and flag12/dirty contracts`);
