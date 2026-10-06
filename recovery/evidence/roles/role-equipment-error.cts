import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reportRoleEquipmentError} from './role-equipment-error';
import {readRoleProfileEquipment, writeRoleProfileEquipment} from '../../../apps/server/src/accounts/profile/equipment';
const evidence = JSON.parse(readFileSync('recovery/output/role-equipment-error-native.json', 'utf8')) as {
  rows: {itemTableId: number; result: number; callback: boolean; notifications: number[]; diagnostics: string[]}[];
  arrays: {before: number[]; old: number[]; values: number[]; after: number[]}[];
};
for (const row of evidence.rows) {
  const notifications: number[] = [], diagnostics: string[] = [];
  reportRoleEquipmentError({instanceId: 71, field14: row.result},
    id => {assert.equal(id, 71); return {instanceId: id, itemTableId: row.itemTableId};},
    row.callback ? category => notifications.push(category) : undefined,
    () => diagnostics.push('Equip Slot Limit'));
  assert.deepEqual(notifications, row.notifications);
  assert.deepEqual(diagnostics, row.diagnostics);
}
for (const row of evidence.arrays) {
  const profile = {bytes: new Uint8Array(row.before), strings: ['name', 'pet'] as [string, string]};
  assert.deepEqual(readRoleProfileEquipment(profile), row.old);
  writeRoleProfileEquipment(profile, row.values);
  assert.deepEqual([...profile.bytes], row.after);
  assert.deepEqual(profile.strings, ['name', 'pet']);
}
console.log('PASS: 80 original equipment errors and16 full profile part array updates');
