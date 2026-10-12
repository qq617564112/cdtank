import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRoleRecomputeMastery} from '../../../apps/server/src/battle/roles/recompute-mastery';
import type {RoleRecomputeValues} from '../../../apps/server/src/battle/roles/recompute-base';
interface Values {recordFields: Record<string, number>; roleIntegers: Record<string, number>;
  roleFloats: Record<string, number>; accumulators: number[]}
const evidence: {scales: {move: number; turn: number}; rows: {input: Values;
  equipmentFields: Record<string, number>; tankType: number; events: {selector: number; value: number}[];
  accumulators: number[]; atk: number; defense: number}[]} =
  JSON.parse(readFileSync('recovery/output/role-recompute-mastery-native.json', 'utf8'));
const map = (fields: Record<string, number>) => new Map(Object.entries(fields).map(([key, value]) => [Number(key), value]));
for (const row of evidence.rows) {
  const state: RoleRecomputeValues = {recordFields: map(row.input.recordFields),
    roleIntegers: map(row.input.roleIntegers), roleFloats: map(row.input.roleFloats), accumulators: [...row.input.accumulators]};
  const result = applyRoleRecomputeMastery(state, {fields: map(row.equipmentFields), name: ''}, row.tankType, evidence.scales);
  assert.deepEqual(result ? [{selector: 10, value: result.move}, {selector: 11, value: result.turn}] : [], row.events);
  assert.deepEqual(state.accumulators, row.accumulators);
  assert.equal(state.roleFloats.get(0x74), row.atk);
  assert.equal(state.roleFloats.get(0x7c), row.defense);
}
console.log(`PASS: ${evidence.rows.length} mastery/type/movement/equipment bonuses match original x86`);
