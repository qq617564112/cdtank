import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestRoleEquipment} from '../../../apps/server/src/accounts/equipment/request';
import type {RoleEquipmentItem, RoleEquipmentRequest} from '../../../apps/server/src/accounts/equipment/request';
interface EvidenceRow {
  record: RoleEquipmentItem;
  slot: number;
  limit: number;
  callback: boolean;
  parts: number[];
  equipped: number[];
  owned: RoleEquipmentItem[];
  sent: (RoleEquipmentRequest & {field14: number})[];
  notifications: number[];
  diagnostics: string[];
}
const evidence: {rows: EvidenceRow[]} = JSON.parse(
  readFileSync('recovery/output/role-equipment-request-native.json', 'utf8'));
for (const row of evidence.rows) {
  const before = JSON.stringify(row);
  const sent: RoleEquipmentRequest[] = [];
  const notifications: number[] = [];
  const diagnostics: string[] = [];
  const accepted = requestRoleEquipment({partSlotCount: row.limit, parts: row.parts,
    equipped: row.equipped, lookupItem: id => row.owned.find(item => item.instanceId === id)},
  row.record, row.slot, request => sent.push(request),
  row.callback ? category => notifications.push(category) : undefined,
  () => diagnostics.push('slot-limit', 'message735'));
  assert.equal(accepted, row.sent.length === 1);
  assert.deepEqual(sent, row.sent.map(({instanceId, slot}) => ({instanceId, slot})));
  assert.deepEqual(notifications, row.notifications);
  assert.deepEqual(diagnostics, row.diagnostics);
  assert.equal(JSON.stringify(row), before);
}
let sent = false;
assert.equal(requestRoleEquipment({partSlotCount: 3, parts: [], equipped: [],
  lookupItem: () => undefined}, undefined, 0, () => {sent = true;}), false);
assert.equal(sent, false);
console.log(`PASS: ${evidence.rows.length} native equipment request decisions and source preservation`);
