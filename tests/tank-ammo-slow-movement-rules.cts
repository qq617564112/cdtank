import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {isPassiveRoleSkill, selectRoleSkills} from '../apps/server/src/battle/roles/skills';
import {readRoleSkillSources} from '../apps/server/src/battle/roles/skill-sources';

const slow = combatSkills.get(4006)!, boost = combatSkills.get(6)!;
assert.equal(slow.triggerType, 8);
assert.equal(slow.attributes.ItemMove, -6);
assert.equal(slow.functions[0].type, 1);
assert.equal(slow.functions[0].t, 15);
assert.equal(boost.attributes.ItemMove, 6);
assert(combatItemSkills.get(2008)!.skillIds.includes(4006));
assert.equal(isPassiveRoleSkill(slow), false);
const rows = [];
const nativeFixtureOnly = process.argv.includes('--native-fixture-only');
for (const tankId of nativeFixtureOnly ? [] : [3, 104]) {
  const tank = TANKS.find(row => row.id === tankId)!;
  const pet = PET_BASES.find(row => row.id === 2)!;
  const role = createRoleCombatState();
  for (const id of combatItemSkills.get(2001)!.skillIds) if (id) role.addSkill(id);
  const slots = role.record!.arrays.get(4)!;
  const sources = () => ({currentSkillIds: Array.from(slots), extraSkill: {baseId: 0, rank: 0}});
  const calculate = () => recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
    ownedField34: 0, tankType: tank.recomputeBase.tankType, sources: sources(),
    skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
    movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
  const mastery = Math.max(1, [pet.field7c, pet.field80, pet.field84, pet.field88][tank.recomputeBase.tankType - 1] - 1);
  const {lower, upper} = combatLimits.get(14)!;
  const expectedSpeed = (modifier: number) => Math.fround(50 + 10 *
    (mastery + Math.max(lower, Math.min(upper, tank.recomputeBase.field84 + modifier)) - 3));
  const baseline = calculate();
  assert.equal(baseline.speed, expectedSpeed(0));
  role.addSkill(4006);
  assert(slots.includes(4006));
  assert(selectRoleSkills(sources(), combatSkills, combatItemSkills).some(skill => skill.skillId === 4006),
    'Current array4 includes trigger8 timed skill without equipment passive filtering');
  const slowed = calculate();
  assert.equal(slowed.speed, expectedSpeed(-6));
  assert.equal(slowed.turn, baseline.turn);
  if (tankId === 3) assert.equal(baseline.speed - slowed.speed, 60);
  else {
    assert(tank.recomputeBase.field84 - 6 < lower);
    assert.equal(slowed.speed, 60, 'Move composite clamps to1 before mastery and conversion');
  }
  role.addSkill(6);
  const stacked = calculate();
  assert.deepEqual(stacked, baseline, 'Active +6 and -6 sum before move clamp');
  role.removeSkill(4006);
  assert(!slots.includes(4006));
  const boostOnly = calculate();
  assert.equal(boostOnly.speed, expectedSpeed(6));
  assert.equal(boostOnly.turn, baseline.turn);
  role.removeSkill(6);
  assert.deepEqual(calculate(), baseline);
  role.addSkill(6); role.addSkill(4006);
  assert.deepEqual(calculate(), baseline, 'Reverse installation order has same additive result');
  role.removeSkill(6);
  assert.deepEqual(calculate(), slowed, 'Boost expires first while slow remains installed');
  role.removeSkill(4006);
  assert.deepEqual(calculate(), baseline);
  rows.push({tankId, petId: 2, ownedField34: 0, mastery, baseline, slowed, stacked, boostOnly});
}
if (nativeFixtureOnly) {
  const sourceFile = 'recovery/output/world-role-attributes-native.json';
  const evidence: {rows: {tankId: number; petId: number; part: number;
    base: Record<string, number>; equipment: Record<string, number>}[]} = JSON.parse(readFileSync(sourceFile, 'utf8'));
  const row = evidence.rows.find(row => row.tankId === 1 && row.part === 0)!;
  assert(row);
  const fields = (values: Record<string, number>) => new Map(Object.entries(values).map(([offset, value]) => [Number(offset), value]));
  const base = fields(row.base), equipment = {name: 'Explicit native tank1 fixture', fields: fields(row.equipment)};
  const tank = TANKS.find(tank => tank.id === equipment.fields.get(0x24))!;
  const pet = PET_BASES.find(pet => pet.id === base.get(8))!;
  const role = createRoleCombatState();
  for (const id of combatItemSkills.get(2001)!.skillIds) if (id) role.addSkill(id);
  const calculate = () => recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
    ownedField34: equipment.fields.get(0x34), tankType: tank.recomputeBase.tankType,
    sources: readRoleSkillSources({currentSkillIds: [...role.record!.arrays.get(4)!],
      boundGear: undefined, equipment, roleFields: role.record!.numericFields!}),
    skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: role.recomputeCounter,
    movementScales: ROLE_INITIAL_MOVEMENT_SCALES})!;
  const baseline = calculate(); role.addSkill(4006);
  const slowed = calculate(); role.removeSkill(4006);
  const restored = calculate();
  assert.deepEqual(restored, baseline);
  assert.equal(slowed.turn, baseline.turn);
  assert(slowed.speed < baseline.speed);
  const fixture = {sourceFile, tankId: tank.id, petId: pet.id, part: row.part,
    ownedField34: equipment.fields.get(0x34), boundGear: 'undefined',
    sourceReader: 'readRoleSkillSources with actual equipment fields and createRoleCombatState numeric fields/current array4',
    baseline, slowed, restored, slowSkillId: 4006, durationSecondsFromSkill: slow.functions[0].t,
    roleValue9: role.recomputeCounter,
    scope: 'Explicit existing native owned fixture; no normal purchase/default binding or actual15second deadline claim'};
  writeFileSync('recovery/output/tank-ammo-slow-native-fixture-rules.json', JSON.stringify({status: 'PASS', fixture}, null, 2) + '\n');
  console.log(JSON.stringify(fixture));
} else {
writeFileSync('recovery/output/tank-ammo-slow-movement-rules.json', JSON.stringify({status: 'PASS', rows,
  source: {skillId: 4006, triggerType: 8, itemMove: -6, funcType: 1, funcT: 15,
    moveLimit: combatLimits.get(14)},
  scope: 'Local rule acceptance of real catalog4006 add/remove through original current array4 and independent movement recompute, lower clamp and skill6 stacking in both orders. No hit authority, timer, inventory, acquisition or multiplayer acceptance.'}, null, 2) + '\n');
console.log('PASS: current array4 skill4006 movement reduction/lower clamp, skill6 stacking and both removals');
}
