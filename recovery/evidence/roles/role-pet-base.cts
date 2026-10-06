import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readRolePetBase} from '../../../apps/server/src/config/role-base';
import type {RolePetBaseDefinition} from '../../../apps/shared/contracts/role-base';
import {PET_BASES} from '../../../apps/server/src/config';
const evidence: {rows: {values: Record<string, string>; result: RolePetBaseDefinition}[]} =
  JSON.parse(readFileSync('recovery/output/role-pet-base-native.json', 'utf8'));
for (const row of evidence.rows) {
  assert.deepEqual(readRolePetBase(row.values), row.result);
  assert.deepEqual(PET_BASES.find(pet => pet.id === row.result.id), row.result);
}
console.log(`PASS: ${evidence.rows.length} source pet loader bindings and server config bases`);
