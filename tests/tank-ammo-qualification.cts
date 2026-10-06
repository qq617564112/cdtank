import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {recomputeRoleAmmo} from '../apps/server/src/battle/roles/recompute-ammo';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {TANKS} from '../apps/server/src/config';
import type {RoleSkillSources} from '../apps/server/src/battle/roles/skills';
import type {RoleRecomputeTankBase} from '../apps/shared/contracts/role-base';

interface NativeRow {
  tank: RoleRecomputeTankBase;
  sources: Omit<RoleSkillSources, 'currentSkillIds' | 'equipmentSkills'> & {
    currentSkillIds: number[] | null;
    equipmentSkills: NonNullable<RoleSkillSources['equipmentSkills']> | null;
  };
  roleValue9: number;
  selected: number[];
  dirty: boolean;
  vip: number;
  values: {recordFields: Record<string, number>; roleFloats: Record<string, number>};
}
const native: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/role-recompute-native.json', 'utf8'));
const common = {skills: combatSkills, items: combatItemSkills, limits: combatLimits};
let verified = 0, vipRows = 0;
for (const row of native.rows) {
  const sources: RoleSkillSources = {...row.sources,
    currentSkillIds: row.sources.currentSkillIds ?? undefined,
    equipmentSkills: row.sources.equipmentSkills ?? undefined};
  const actual = recomputeRoleAmmo({...common, tank: row.tank, sources, roleValue9: row.roleValue9});
  if (row.dirty) {assert.equal(actual, undefined); continue;}
  assert(actual);
  assert.deepEqual(actual.selectedSkillIds, row.selected);
  assert.equal(actual.capacity, row.values.recordFields['56']);
  assert.equal(actual.normalSeconds, row.values.roleFloats['80']);
  assert.equal(actual.lastBulletSeconds, row.values.roleFloats['84']);
  verified++;
  if (row.vip) vipRows++;
}
assert(vipRows > 0);

// All real definitions use their own TankDelay/TankBullet with installed2001 skills.
// No owned-record, pet, health or VIP inputs are supplied to this rule check.
const ordinaryIds = combatItemSkills.get(2001)!.skillIds.filter(id => combatSkills.has(id));
const ordinarySources: RoleSkillSources = {currentSkillIds: ordinaryIds,
  extraSkill: {baseId: 0, rank: 0}};
const rows = TANKS.map(tank => {
  const actual = recomputeRoleAmmo({...common, tank: tank.recomputeBase,
    sources: ordinarySources, roleValue9: 0})!;
  const normalTenths = Math.max(5, Math.min(99, tank.recomputeBase.reloadDuration + 17));
  assert.equal(actual.capacity, Math.max(3, Math.min(9, tank.recomputeBase.field90 + 6)));
  assert.equal(actual.normalSeconds, Math.fround(normalTenths * Math.fround(.1)));
  assert.equal(actual.lastBulletSeconds,
    Math.fround(normalTenths * Math.fround(.1) * 100 * Math.fround(.03)));
  assert.deepEqual(actual.selectedSkillIds, ordinaryIds);
  return {tankId: tank.id, tankDelay: tank.recomputeBase.reloadDuration,
    tankBullet: tank.recomputeBase.field90, ...actual};
});
assert.equal(rows.length, 21);
assert(new Set(rows.map(row => row.normalSeconds)).size > 1);
writeFileSync('recovery/output/tank-ammo-qualification.json', JSON.stringify({status: 'PASS',
  originalRows: verified, vipRows, rows,
  scope: 'Independent ammo rule and existing x86 oracle; no formal player/CPU wiring or multiplayer acceptance.'}, null, 2));
console.log(`PASS: ${verified} original x86 ammo vectors (${vipRows} VIP) and 21 actual tank definitions without owned HP dependencies`);
