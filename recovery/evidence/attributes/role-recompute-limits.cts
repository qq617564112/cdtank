import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {limitRoleRecomputeValues, convertRoleRecomputeValues} from '../../../apps/server/src/battle/roles/recompute-limits';
import type {RoleRecomputeValues} from '../../../apps/server/src/battle/roles/recompute-base';
import {readRoleDataScaleLimits} from '../../../apps/server/src/battle/roles/data-scale';
import type {CombatCatalog} from '../../../apps/shared/combat/catalog';
interface Values {
  recordFields: Record<string, number>; roleIntegers: Record<string, number>;
  roleFloats: Record<string, number>; accumulators: number[];
}
const evidence: {limits: Record<string, {lower: number; upper: number}>; rows: {
  input: Values; bounded: Values; converted: Values; vip: number; vipMultiplier: number;
}[]} = JSON.parse(readFileSync('recovery/output/role-recompute-limits-native.json', 'utf8'));
const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const limits = readRoleDataScaleLimits(catalog.dataScales);
assert.deepEqual(Object.fromEntries(limits), evidence.limits);
const mapFields = (fields: Record<string, number>) => new Map(Object.entries(fields).map(([key, value]) => [Number(key), value]));
const plain = (state: RoleRecomputeValues): Values => ({
  recordFields: Object.fromEntries(state.recordFields), roleIntegers: Object.fromEntries(state.roleIntegers),
  roleFloats: Object.fromEntries(state.roleFloats), accumulators: state.accumulators,
});
for (const row of evidence.rows) {
  const state: RoleRecomputeValues = {recordFields: mapFields(row.input.recordFields),
    roleIntegers: mapFields(row.input.roleIntegers), roleFloats: mapFields(row.input.roleFloats),
    accumulators: [...row.input.accumulators]};
  limitRoleRecomputeValues(state, limits);
  assert.deepEqual(plain(state), row.bounded);
  convertRoleRecomputeValues(state, row.vip, row.vipMultiplier);
  assert.deepEqual(plain(state), row.converted);
}
console.log(`PASS: ${evidence.rows.length} all-field loaded bounds and final conversions match original x86`);
