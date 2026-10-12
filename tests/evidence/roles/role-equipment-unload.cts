import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestRoleEquipmentUnload} from '../../../apps/server/src/accounts/equipment/unload';
import type {RoleEquipmentItem} from '../../../apps/server/src/accounts/equipment/request';

interface UnloadRow {
  record: RoleEquipmentItem & {state: number};
  parts: number[];
  equipped: number[];
  skinInstanceId: number;
  markInstanceId: number;
  owned: RoleEquipmentItem[];
  sent: {instanceId: number; field10: number}[];
  seed: number;
}

const evidence = JSON.parse(readFileSync('recovery/output/role-equipment-unload-native.json', 'utf8')) as {
  status: string;
  rows: UnloadRow[];
  wire: {bits: number; value: number}[];
};
assert.equal(evidence.status, 'PASS');
assert.equal(evidence.rows.length, 1408);
for (const row of evidence.rows) {
  const before = structuredClone(row);
  const lookup = (id: number) => row.owned.find(item => item.instanceId === id);
  const context = {...row, lookupPart: lookup, lookupMark: lookup, lookupSkin: lookup};
  const sent: number[] = [];
  const result = requestRoleEquipmentUnload(context, row.record, id => sent.push(id));
  assert.deepEqual(sent, row.sent.map(packet => packet.instanceId), JSON.stringify(row));
  assert.equal(result, row.sent.length !== 0);
  for (const packet of row.sent) assert.equal(packet.field10, row.seed);
  assert.deepEqual(row, before);
  assert.equal(requestRoleEquipmentUnload(context, undefined, () => {
    assert.fail('Null inventory record emitted an unload request');
  }), false);
}
assert.deepEqual(evidence.wire, [{bits: 32, value: 71}, {bits: 32, value: 0x8bad0012}]);
console.log('PASS: 1408 original unload gates, null records, unchanged sources and uninitialized second wire field');
