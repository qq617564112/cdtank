import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import type {RoleRecomputeTankBase, RoleRecomputePetBase} from '../apps/shared/contracts/role-base';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import type {RoleSkillSources} from '../apps/server/src/battle/roles/skills';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';

interface NativeRow {
  sourceIndex: number;
  tank: RoleRecomputeTankBase;
  pet: RoleRecomputePetBase;
  tankType: number;
  equipmentField34: number;
  sourceFields: {equipment: Record<string, number>};
  ownedPairIndex: number | null;
  sources: Omit<RoleSkillSources, 'currentSkillIds' | 'equipmentSkills'> & {
    currentSkillIds: number[] | null;
    equipmentSkills: NonNullable<RoleSkillSources['equipmentSkills']> | null;
  };
  roleValue9: number;
  vip: number;
  vipMultiplier: number;
  selected: number[];
  dirty: boolean;
  values: {roleIntegers: Record<string, number>; roleFloats: Record<string, number>};
}
const native: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/role-recompute-native.json', 'utf8'));
const equipment: {rows: {result: Record<string, number>}[]} = JSON.parse(readFileSync('recovery/output/role-owned-equipment-native.json', 'utf8'));
const pairs: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
const common = {skills: combatSkills, items: combatItemSkills, limits: combatLimits};
let vectors = 0, rejections = 0;
for (const row of native.rows) {
  let fields = new Map(Object.entries(equipment.rows[row.sourceIndex].result).map(([key, value]) => [Number(key), value]));
  if (row.ownedPairIndex !== null) {
    const pair = pairs.rows[row.ownedPairIndex];
    fields = new Map(readOwnedRolePairMessage(new Uint8Array(pair.raw), pair.alignment,
      bytes => Buffer.from(bytes).toString('hex')).equipment.fields);
  }
  for (const [key, value] of Object.entries(row.sourceFields.equipment)) fields.set(Number(key), value);
  fields.set(0x34, row.equipmentField34);
  const sources: RoleSkillSources = {...row.sources,
    currentSkillIds: row.sources.currentSkillIds ?? undefined,
    equipmentSkills: row.sources.equipmentSkills ?? undefined};
  const actual = recomputeQualifiedRoleArmor({...common, sources,
    tank: row.tank, tankType: row.tankType, pet: row.pet, roleValue9: row.roleValue9,
    ownedField34: fields.get(0x34), ownedAtk: fields.get(0x3c), ownedAtkBonus: fields.get(0x40),
    ownedDef: fields.get(0x4c), ownedDefBonus: fields.get(0x50)});
  if (row.dirty) {assert.equal(actual, undefined); rejections++;}
  else {
    assert.deepEqual(actual, {attackBase: row.values.roleIntegers[String(0x70)],
      attackBonus: row.values.roleIntegers[String(0x78)], attackPercent: row.values.roleFloats[String(0x74)],
      defenseBonus: row.values.roleIntegers[String(0x88)], defensePercent: row.values.roleFloats[String(0x7c)],
      sideDefensePercent: row.values.roleFloats[String(0x80)], backDefensePercent: row.values.roleFloats[String(0x84)],
      selectedSkillIds: row.selected}); vectors++;
  }
}
const input = {...common, tank: TANKS.find(t => t.id === 3)!.recomputeBase, pet: PET_BASES.find(p => p.id === 2)!,
  tankType: TANKS.find(t => t.id === 3)!.recomputeBase.tankType, ownedField34: 0, ownedAtk: 122, ownedAtkBonus: 78, ownedDef: 17, ownedDefBonus: 44,
  sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds, extraSkill: {baseId: 0, rank: 0}}, roleValue9: 0};
assert(recomputeQualifiedRoleArmor(input));
for (const field of ['ownedField34', 'ownedAtk', 'ownedAtkBonus', 'ownedDef', 'ownedDefBonus'] as const) {
  assert.equal(recomputeQualifiedRoleArmor({...input, [field]: undefined}), undefined);
}
assert.equal(recomputeQualifiedRoleArmor({...input, sources: {...input.sources, currentSkillIds: undefined}}), undefined);
assert.equal(recomputeQualifiedRoleArmor({...input, tankType: 0}), undefined);
for (const id of [7, 8, 9, 10, 11, 12, 13]) {
  const limits = new Map(combatLimits); limits.delete(id);
  assert.equal(recomputeQualifiedRoleArmor({...input, limits}), undefined);
}
writeFileSync('recovery/output/tank-armor-qualification.json', JSON.stringify({status: 'PASS',
  originalArmorVectors: vectors, originalRejections: rejections,
  scope: 'Original seven attribute composition fields and native source selection; explicit missing-owned-field, skill, limit and invalid-type refusals. No hit damage, player wiring or network claim.'}, null, 2));
console.log(`PASS: ${vectors} original armor vectors, ${rejections} refusals and independent source checks`);
