import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleRecordNumericDefaults, ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';

const evidence: {rows: {fields: Record<string, number>; counter: number}[];
  scales: {move: number; turn: number}} = JSON.parse(readFileSync('recovery/output/role-record-defaults-native.json', 'utf8'));
assert.deepEqual(ROLE_INITIAL_MOVEMENT_SCALES, evidence.scales);
for (const row of evidence.rows) {
  const state = createRoleCombatState();
  assert.deepEqual(Object.fromEntries(createRoleRecordNumericDefaults()), row.fields);
  assert.equal(state.recomputeCounter, row.counter);
  assert.equal(state.record!.numericFields!.get(0x88), 0);
  assert.equal(state.record!.numericFields!.get(0x8c), 0);
  assert.deepEqual(readRoleSkillSources({currentSkillIds: [...state.record!.arrays.get(4)!],
    boundGear: undefined, equipment: {name: '', fields: new Map([[0x58, 13001], [0x5c, 0], [0x60, 0]])},
    roleFields: state.attributeSourceFields()!}), {currentSkillIds: Array(16).fill(0),
    equipmentSkills: undefined, extraSkill: {baseId: 0, rank: 0}, itemIds: [13001, 0, 0, 0, 0, 0, 0, 0, 0, 0]});
  state.setArray(2, [13002, 14001, 15001, 16001, 17001]);
  assert.deepEqual([0xbc, 0xc0, 0xc4, 0xc8, 0xcc].map(offset => state.attributeSourceFields()!.get(offset)),
    [13002, 14001, 15001, 16001, 17001]);
  state.setStatus(2);
  assert.equal(state.attributeSourceFields()!.get(0x90), 2);
  const other = createRoleCombatState();
  state.record!.numericFields!.set(0x88, 123);
  assert.equal(other.attributeSourceFields()!.get(0x88), 0);
  const detached = state.attributeSourceFields()! as Map<number, number>;
  detached.set(0x88, 999);
  assert.equal(state.attributeSourceFields()!.get(0x88), 123);
}
assert.equal(new RoleCombatState(undefined).attributeSourceFields(), undefined);
assert.equal(new RoleCombatState({status: 0, flags: new Uint8Array(16), arrays: new Map()}).attributeSourceFields(), undefined);
console.log('PASS: original numeric defaults/scales/counter, production skill fields, actual table-ID arrays, detached reads and missing record preservation');
