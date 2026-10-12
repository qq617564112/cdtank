import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readRoleTankBase} from '../../../apps/server/src/config/role-base';
import type {RoleTankBaseDefinition} from '../../../apps/shared/contracts/role-base';
import {TANKS} from '../../../apps/server/src/config';
const evidence: {rows: {values: Record<string, string>; result: RoleTankBaseDefinition}[]} =
  JSON.parse(readFileSync('recovery/output/role-tank-base-native.json', 'utf8'));
for (const row of evidence.rows) {
  assert.deepEqual(readRoleTankBase(row.values), row.result);
  assert.deepEqual(TANKS.find(tank => tank.id === row.result.id)!.recomputeBase, row.result);
}
console.log(`PASS: ${evidence.rows.length} source tank loader bindings and server config bases`);
