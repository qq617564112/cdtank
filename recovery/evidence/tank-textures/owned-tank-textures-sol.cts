import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {receiveOwnedRoleEquipmentBatch} from '../roles/role-owned-equipment';
import type {OwnedRoleEquipmentRecord} from '../../../apps/shared/contracts/owned-equipment';
import {resolveOwnedRoleTank} from '../../../apps/server/src/accounts/owned/definition';
import {readOwnedTankTextures} from '../../../apps/shared/combat/role-owned-textures';

interface NativeRow {
  alignment: number;
  raw: number[];
  finalBit: number;
  instanceId: number;
  definitionId: number;
  selectedIds: number[];
  comparisons: {candidateId: number; matched: boolean}[];
}
const evidence: {rows: NativeRow[]} = JSON.parse(
  readFileSync('recovery/output/owned-tank-textures-sol-native.json', 'utf8'));
const records = new Map<number, OwnedRoleEquipmentRecord>();
for (const row of evidence.rows) {
  assert.equal(receiveOwnedRoleEquipmentBatch(records, new Uint8Array(row.raw), row.alignment,
    bytes => Buffer.from(bytes).toString('hex')), row.finalBit);
  const record = records.get(row.instanceId)!;
  assert(record);
  const lookups: number[] = [];
  assert.equal(resolveOwnedRoleTank(records, row.instanceId, id => {
    lookups.push(id);
    return id;
  }), row.definitionId);
  assert.deepEqual(lookups, [row.definitionId]);
  const selected = readOwnedTankTextures(record)!;
  assert.deepEqual([selected.U, selected.M, selected.XY], row.selectedIds);
  for (const [slot, comparison] of row.comparisons.entries()) {
    assert.equal(row.selectedIds[slot] === comparison.candidateId, comparison.matched);
  }
}
for (const missingOffset of [0x28, 0x2c, 0x30]) {
  const fields = new Map([[0x28, 10011], [0x2c, 10012], [0x30, 10013]]);
  fields.delete(missingOffset);
  assert.equal(readOwnedTankTextures({fields, name: ''}), undefined);
}
assert.deepEqual(readOwnedTankTextures({fields: new Map([[0x28, 0], [0x2c, -1], [0x30, -2147483647]]), name: ''}),
  {U: 0, M: 0xffffffff, XY: 0x80000001});
console.log(`PASS: ${evidence.rows.length} original owned tank wire/storage/getter/texture contracts and incomplete source gates`);
