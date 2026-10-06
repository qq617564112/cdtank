import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {recomputeQualifiedRoleLife} from '../apps/server/src/battle/roles/recompute-life';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import type {RoleSkillSources} from '../apps/server/src/battle/roles/skills';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources';

interface NativeRow {
  sourceIndex: number;
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
  values: {recordFields: Record<string, number>};
}
const native: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/role-recompute-native.json', 'utf8'));
const base: {rows: {result: Record<string, number>}[]} = JSON.parse(readFileSync('recovery/output/role-owned-base-native.json', 'utf8'));
const pairs: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
const common = {skills: combatSkills, items: combatItemSkills, limits: combatLimits};
let vectors = 0, vipVectors = 0, rejections = 0;
for (const row of native.rows) {
  let ownedHp = base.rows[row.sourceIndex].result[String(0x2c)];
  if (row.ownedPairIndex !== null) {
    const pair = pairs.rows[row.ownedPairIndex];
    ownedHp = readOwnedRolePairMessage(new Uint8Array(pair.raw), pair.alignment,
      bytes => Buffer.from(bytes).toString('hex')).base.fields.get(0x2c)!;
  }
  const sources: RoleSkillSources = {...row.sources,
    currentSkillIds: row.sources.currentSkillIds ?? undefined,
    equipmentSkills: row.sources.equipmentSkills ?? undefined};
  const actual = recomputeQualifiedRoleLife({...common, ownedHp, sources,
    roleValue9: row.roleValue9, vip: row.vip, vipMultiplier: row.vipMultiplier});
  if (row.dirty) {assert.equal(actual, undefined); rejections++;}
  else {
    assert.deepEqual(actual, {maxHp: row.values.recordFields[String(0x58)], selectedSkillIds: row.selected});
    vectors++; if ((row.vip & 255) !== 0) vipVectors++;
  }
}
const input = {...common, ownedHp: 700, sources: {currentSkillIds: combatItemSkills.get(2001)!.skillIds,
  extraSkill: {baseId: 0, rank: 0}}, roleValue9: 0, vip: 0, vipMultiplier: undefined};
assert.equal(recomputeQualifiedRoleLife(input)!.maxHp, 700);
assert.equal(recomputeQualifiedRoleLife({...input, ownedHp: undefined}), undefined);
assert.equal(recomputeQualifiedRoleLife({...input, vip: undefined}), undefined);
assert.equal(recomputeQualifiedRoleLife({...input, vip: 1}), undefined);
assert.equal(recomputeQualifiedRoleLife({...input, sources: {...input.sources, currentSkillIds: undefined}}), undefined);
assert.equal(recomputeQualifiedRoleLife({...input, limits: new Map()}), undefined);
assert.equal(recomputeQualifiedRoleLife({...input, vip: 256})!.maxHp, 700);
writeFileSync('recovery/output/tank-life-qualification.json', JSON.stringify({status: 'PASS',
  originalLifeVectors: vectors, originalVipVectors: vipVectors, originalRejections: rejections,
  scope: 'Original MaxHP formula vectors with explicit native VIP multiplier only; normal independent missing-source refusals. No actual VIP multiplier producer, player life wiring or network claim.'}, null, 2));
console.log(`PASS: ${vectors} original life vectors (${vipVectors} explicit VIP), ${rejections} refusals and independent source checks`);
