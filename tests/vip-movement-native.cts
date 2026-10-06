import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {RoleTankBaseDefinition, RolePetBaseDefinition} from '../apps/shared/contracts/role-base';
import {recomputeRoleAttributes, recomputeRoleMovement} from '../apps/server/src/battle/roles/recompute';
import {readRoleDataScaleLimits} from '../apps/server/src/battle/roles/data-scale';

interface NativeValues {
  recordFields: Record<string, number>;
  roleIntegers: Record<string, number>;
  roleFloats: Record<string, number>;
}
interface NativeRow {
  base: Record<string, number>;
  equipment: Record<string, number>;
  tank: RoleTankBaseDefinition;
  pet: RolePetBaseDefinition;
  part: number;
  vip: number;
  vipMultiplier: number;
  movement: {kind: 'movement'; selector: 10 | 11; value: number}[];
  maxHp: number;
  hp: number;
  values: NativeValues;
  selected: number[];
}
const native: {status: string; groups: number; scales: {move: number; turn: number}; rows: NativeRow[]} =
  JSON.parse(readFileSync('recovery/output/vip-movement-native.json', 'utf8'));
const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const skills = new Map(catalog.skills.map(skill => [skill.skillId, skill]));
const items = new Map(catalog.items.map(item => [item.itemTableId, {itemId: item.itemTableId, skillIds: item.skillIds}]));
const limits = readRoleDataScaleLimits(catalog.dataScales);
const map = (fields: Record<string, number>) => new Map(Object.entries(fields).map(([key, value]) => [Number(key), value]));
const groups = new Map<string, NativeRow[]>();
assert.equal(native.status, 'PASS');
assert.equal(native.rows.length, 21 * 6 * 3 * 3);
for (const row of native.rows) {
  const input = {
    base: {name: 'Imported pet', fields: map(row.base)},
    equipment: {name: 'Imported tank', fields: map(row.equipment)},
    tank: row.tank, pet: row.pet,
    sources: {currentSkillIds: Array<number>(16).fill(0), equipmentSkills: undefined,
      extraSkill: {baseId: 0, rank: 0}, itemIds: [0, 0, 0, row.part, 0, 0, 0, 0, 0, 0]},
    skills, items, limits, roleValue9: 0, tankType: row.tank.tankType, movementScales: native.scales,
  };
  const expected = {speed: row.movement[0].value, turn: row.movement[1].value};
  assert.deepEqual(row.movement.map(event => event.selector), [10, 11]);
  assert.deepEqual(recomputeRoleMovement(input), expected,
    `Movement prefix differs for tank${row.tank.id}/part${row.part}/VIP${row.vip}/multiplier${row.vipMultiplier}`);
  const movement: NativeRow['movement'] = [];
  const full = recomputeRoleAttributes({...input, vip: row.vip, vipMultiplier: row.vipMultiplier}, {
    setMovement: (selector, value) => {movement.push({kind: 'movement', selector, value});},
    notify: () => {}, clearDirty: () => {},
  });
  assert.equal(full.completed, true);
  assert.deepEqual(movement, row.movement);
  assert.deepEqual(full.selectedSkillIds, row.selected);
  assert.deepEqual({recordFields: Object.fromEntries(full.state.recordFields),
    roleIntegers: Object.fromEntries(full.state.roleIntegers), roleFloats: Object.fromEntries(full.state.roleFloats)}, row.values);
  assert.equal(full.state.recordFields.get(0x58), row.maxHp);
  assert.equal(row.hp, 777);
  const key = `${row.tank.id}/${row.part}`;
  const variants = groups.get(key) ?? [];
  variants.push(row);
  groups.set(key, variants);
}
for (const variants of groups.values()) {
  assert.equal(variants.length, 9);
  assert.deepEqual(variants.map(row => [row.vip, row.vipMultiplier]),
    [[0, 0], [0, 1], [0, 3], [1, 0], [1, 1], [1, 3], [2, 0], [2, 1], [2, 3]]);
  const baseline = variants[0];
  assert(baseline.maxHp > 0);
  for (const variant of variants) {
    assert.deepEqual(variant.base, baseline.base);
    assert.deepEqual(variant.equipment, baseline.equipment);
    assert.deepEqual(variant.movement, baseline.movement);
    assert.equal(variant.maxHp, variant.vip === 0 ? baseline.maxHp : baseline.maxHp * variant.vipMultiplier);
  }
  assert.equal(new Set(variants.map(row => row.maxHp)).size, 3);
}
assert.equal(groups.size, native.groups);
assert.equal(groups.size, 126);
assert.equal(new Set(native.rows.map(row => row.tank.id)).size, 21);
assert.equal(new Set(native.rows.map(row => row.pet.id)).size, 10);
assert.equal(new Set(native.rows.map(row => row.part)).size, 6);
writeFileSync('recovery/output/vip-movement.json', JSON.stringify({status: 'PASS', nativeRows: native.rows.length,
  identicalOwnedInputGroups: groups.size, tanks: 21, pets: 10, parts: 6,
  movementPrefixMatchesOriginal: true, fullAttributesMatchOriginal: true,
  vipMovementInvariant: true, nativeVipTailChangesMaxHp: true,
  scope: 'Production movement-only prefix and full normal recompute match complete original433466 with controlled VIP/multiplier inputs. Multiplier provenance is not inferred.'}, null, 2) + '\n');
console.log(`PASS: ${native.rows.length} original VIP-tail cases; movement-only and normal recompute match all126 identical-owned-input movement groups`);
