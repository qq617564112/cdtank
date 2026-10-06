import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveOwnedRolePet, resolveOwnedRoleTank} from '../../../apps/server/src/accounts/owned/definition';
import {PET_BASES, TANKS} from '../../../apps/server/src/config';

const evidence: {rows: {kind: 'base' | 'equipment'; tableId: number; instanceId: number;
  ownedFound: boolean; recordPresent: boolean; managerPresent: boolean; tableFound: boolean;
  result: boolean; lookups: number[]}[]} = JSON.parse(
  readFileSync('recovery/output/role-owned-definition-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = {name: 'owned', fields: new Map([[row.kind === 'base' ? 8 : 0x24, row.tableId]])};
  const records = new Map(row.ownedFound ? [[row.instanceId, row.recordPresent ? record : undefined]] : []);
  const calls: number[] = [];
  const definition = row.kind === 'base' ? PET_BASES.find(pet => pet.id === row.tableId)!
    : TANKS.find(tank => tank.id === row.tableId)!.recomputeBase;
  assert(definition);
  const lookup = row.managerPresent ? (id: number) => {
    calls.push(id);
    return row.tableFound ? definition : undefined;
  } : undefined;
  const result = row.kind === 'base' ? resolveOwnedRolePet(records, row.instanceId, lookup)
    : resolveOwnedRoleTank(records, row.instanceId, lookup);
  assert.equal(result !== undefined, row.result);
  if (result) assert.strictEqual(result, definition);
  assert.deepEqual(calls, row.lookups);
}
console.log(`PASS: ${evidence.rows.length} owned instance → formal pet/tank definition contracts`);
