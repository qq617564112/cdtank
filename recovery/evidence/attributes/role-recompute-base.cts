import type {RoleRecomputeTankBase, RoleRecomputePetBase} from '../../../apps/shared/contracts/role-base';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readOwnedRoleBasePacket} from '../roles/role-owned-base';
import {readOwnedRoleEquipmentRecord} from '../roles/role-owned-equipment';
import {initializeRoleRecomputeBase} from '../../../apps/server/src/battle/roles/recompute-base';

import {accumulateRoleMaxHp} from '../roles/role-max-hp';
import {accumulateRoleReload} from '../roles/reload';
import {roleSkillMultiplier} from '../../../apps/server/src/battle/roles/reload';
import type {CombatCatalog} from '../../../apps/shared/combat/catalog';

import {accumulateRoleRecomputeSkill} from '../../../apps/server/src/battle/roles/recompute-skill';
import {selectRoleItemSkills} from '../../../apps/server/src/battle/roles/skills';
import type {RoleRecomputeValues} from '../../../apps/server/src/battle/roles/recompute-base';

interface SourceRow {alignment: number; raw: number[]; finalBit: number}
const baseRows: SourceRow[] = JSON.parse(readFileSync('recovery/output/role-owned-base-native.json', 'utf8')).rows;
const equipmentRows: SourceRow[] = JSON.parse(readFileSync('recovery/output/role-owned-equipment-native.json', 'utf8')).rows;
interface StateValues {
  recordFields: Record<string, number>;
  roleIntegers: Record<string, number>;
  roleFloats: Record<string, number>;
  accumulators: number[];
}
const evidence: {itemRows: {sourceIndex: number; itemId: number | null; currentSkillIds: number[];
  roleValue9: number; selected: number[]; values: StateValues; hp: number}[]; combinations: {sourceIndex: number; skillId: number; roleValue9: number; maxHp: number;
  values: StateValues; hp: number; reload: {baseDuration: number; type1Factor: number}}[]; rows: {baseIndex: number; equipmentIndex: number; tank: RoleRecomputeTankBase;
  pet: RoleRecomputePetBase; recordFields: Record<string, number>; roleIntegers: Record<string, number>;
  roleFloats: Record<string, number>; accumulators: number[]; hp: number}[]} =
  JSON.parse(readFileSync('recovery/output/role-recompute-base-native.json', 'utf8'));
const initializedRows: ReturnType<typeof initializeRoleRecomputeBase>[] = [];
for (const row of evidence.rows) {
  const baseSource = baseRows[row.baseIndex]!;
  const base = readOwnedRoleBasePacket(new Uint8Array(baseSource.raw), baseSource.alignment,
    bytes => Buffer.from(bytes).toString('hex')).record;
  const equipmentSource = equipmentRows[row.equipmentIndex]!;
  let cursor = equipmentSource.alignment;
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      value += ((equipmentSource.raw[cursor >>> 3]! >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  const equipment = readOwnedRoleEquipmentRecord({unsigned, name: () => {
    const nameBytes = new Uint8Array(unsigned(32));
    for (let index = 0; index < nameBytes.length; index++) nameBytes[index] = unsigned(8);
    return Buffer.from(nameBytes).toString('hex');
  }});
  assert.equal(cursor, equipmentSource.finalBit);
  const initialized = initializeRoleRecomputeBase(base, equipment, row.tank, row.pet);
  initializedRows.push(initialized);
  assert.deepEqual(Object.fromEntries(initialized.recordFields), row.recordFields);
  assert.deepEqual(Object.fromEntries(initialized.roleIntegers), row.roleIntegers);
  assert.deepEqual(Object.fromEntries(initialized.roleFloats), row.roleFloats);
  assert.deepEqual(initialized.accumulators, row.accumulators);
  assert.equal(initialized.recordFields.has(0x54), false);
  assert.equal(row.hp, 777);
}
console.log(`PASS: ${evidence.rows.length} parsed owned-source records → complete recompute base initialization`);

const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const skills = new Map(catalog.skills.map(skill => [skill.skillId, skill]));
for (const row of evidence.combinations) {
  const initialized = initializedRows[row.sourceIndex]!;
  const skill = skills.get(row.skillId)!;
  const multiplier = roleSkillMultiplier(skill.triggerType, row.roleValue9, skill.functions[0]!.z);
  const maxHp = accumulateRoleMaxHp(initialized.recordFields.get(0x58)!, {
    triggerType: skill.triggerType, funcZ1: skill.functions[0]!.z, maxHp: skill.attributes.MaxHP,
  }, row.roleValue9);
  assert.equal(maxHp, row.maxHp);
  const reload = accumulateRoleReload({baseDuration: initialized.roleFloats.get(0x50)!,
    type1Factor: initialized.roleFloats.get(0x54)!}, skill.attributes.Delay, skill.attributes.LoadTime, multiplier);
  assert.deepEqual(reload, row.reload);
  assert.equal(row.hp, 777);
}
console.log(`PASS: ${evidence.combinations.length} source bases → source skill MaxHP/reload additions`);

const copyState = (state: RoleRecomputeValues): RoleRecomputeValues => ({
  recordFields: new Map(state.recordFields), roleIntegers: new Map(state.roleIntegers),
  roleFloats: new Map(state.roleFloats), accumulators: [...state.accumulators],
});
const plainState = (state: RoleRecomputeValues): StateValues => ({
  recordFields: Object.fromEntries(state.recordFields), roleIntegers: Object.fromEntries(state.roleIntegers),
  roleFloats: Object.fromEntries(state.roleFloats), accumulators: state.accumulators,
});
for (const row of evidence.combinations) {
  const state = copyState(initializedRows[row.sourceIndex]!);
  accumulateRoleRecomputeSkill(state, skills.get(row.skillId), row.roleValue9);
  assert.deepEqual(plainState(state), row.values);
}
const items = new Map(catalog.items.map(item => [item.itemTableId,
  {itemId: item.itemTableId, skillIds: item.skillIds}]));
for (const row of evidence.itemRows) {
  const state = copyState(initializedRows[row.sourceIndex]!);
  const selected = selectRoleItemSkills(row.itemId === null ? [] : [row.itemId], row.currentSkillIds, skills, items);
  assert.deepEqual(selected.map(skill => skill.skillId), row.selected);
  for (const skill of selected) accumulateRoleRecomputeSkill(state, skill, row.roleValue9);
  assert.deepEqual(plainState(state), row.values);
  assert.equal(row.hp, 777);
}
console.log(`PASS: ${evidence.combinations.length} full skill field contracts and ${evidence.itemRows.length} source item expansions`);
