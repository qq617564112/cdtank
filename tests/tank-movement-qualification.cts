import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {recomputeRoleMovement} from '../apps/server/src/battle/roles/recompute';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import type {RoleRecomputePrefixInput} from '../apps/server/src/battle/roles/recompute';
import type {RoleSkillSources} from '../apps/server/src/battle/roles/skills';

interface NativeRow {
  tank: RoleRecomputePrefixInput['tank'];
  pet: RoleRecomputePrefixInput['pet'];
  equipmentField34: number;
  tankType: number;
  sources: Omit<RoleSkillSources, 'currentSkillIds' | 'equipmentSkills'> & {
    currentSkillIds: number[] | null;
    equipmentSkills: NonNullable<RoleSkillSources['equipmentSkills']> | null;
  };
  roleValue9: number;
  events: {kind: string; selector?: number; value?: number}[];
}
const native: {rows: NativeRow[]; scales: {move: number; turn: number}} =
  JSON.parse(readFileSync('recovery/output/role-recompute-native.json', 'utf8'));
const common = {skills: combatSkills, items: combatItemSkills, limits: combatLimits};
let vectors = 0, rejected = 0;
for (const row of native.rows) {
  const sources: RoleSkillSources = {...row.sources,
    currentSkillIds: row.sources.currentSkillIds ?? undefined,
    equipmentSkills: row.sources.equipmentSkills ?? undefined};
  const actual = recomputeQualifiedRoleMovement({...common, sources, tank: row.tank,
    pet: row.pet, ownedField34: row.equipmentField34, tankType: row.tankType,
    roleValue9: row.roleValue9, movementScales: native.scales});
  const events = row.events.filter(event => event.kind === 'movement');
  if (events.length === 0) {assert.equal(actual, undefined); rejected++;}
  else {
    assert.deepEqual(actual, {speed: events.find(event => event.selector === 10)!.value,
      turn: events.find(event => event.selector === 11)!.value});
    vectors++;
  }
}
const pet = PET_BASES.find(pet => pet.id === 1)!;
assert.deepEqual([pet.field7c, pet.field80, pet.field84, pet.field88], [3, 3, 3, 3]);
const ordinary = combatItemSkills.get(2001)!.skillIds;
const source: RoleSkillSources = {currentSkillIds: ordinary, extraSkill: {baseId: 0, rank: 0}};
const clamp = (value: number, id: number): number => {
  const {lower, upper} = combatLimits.get(id)!;
  return Math.max(lower, Math.min(upper, value));
};
const rows = [];
for (const tank of TANKS) {
  for (const ownedField34 of [0, 1]) {
    for (const drivingBound of [false, true]) {
      // This is a conditional source vector, never a claim that selecting pet1 binds gear.
      const sources: RoleSkillSources = {...source,
        equipmentSkills: drivingBound ? [{baseId: 10151, rank: 1}] : undefined};
      const input = {...common, tank: tank.recomputeBase, pet, ownedField34, sources,
        roleValue9: 0, tankType: tank.recomputeBase.tankType,
        movementScales: ROLE_INITIAL_MOVEMENT_SCALES};
      const actual = recomputeQualifiedRoleMovement(input)!;
      const mastery = 3 + Number(drivingBound) - Number(ownedField34 === 0);
      assert.equal(actual.speed, 50 + 10 * (mastery + clamp(tank.recomputeBase.field84, 14) - 3));
      const degrees = 11 + 4 * (mastery + clamp(tank.recomputeBase.field88, 15) - 3);
      assert(Math.abs(actual.turn - degrees * Math.PI / 180) < .000001);
      assert.equal(recomputeQualifiedRoleMovement({...input, ownedField34: undefined}), undefined);
      assert.equal(recomputeQualifiedRoleMovement({...input,
        sources: {...sources, currentSkillIds: undefined}}), undefined);
      assert.equal(recomputeQualifiedRoleMovement({...input, tankType: 0}), undefined);
      // Compatibility entry consumes only owned+34; all HP/critical/armor reads fail.
      const fields = new Map([[0x34, ownedField34]]);
      fields.get = offset => {
        assert.equal(offset, 0x34, 'Movement must not read HP or armor');
        return ownedField34;
      };
      assert.deepEqual(recomputeRoleMovement({...input,
        base: {name: '', fields: new Map()}, equipment: {name: '', fields}}), actual);
      rows.push({tankId: tank.id, ownedField34, drivingBound, mastery, ...actual});
    }
  }
}
writeFileSync('recovery/output/tank-movement-qualification.json', JSON.stringify({status: 'PASS',
  originalMovementVectors: vectors, originalRejectedVectors: rejected, rows,
  scope: 'Original x86 movement vectors and21 actual definitions × explicit owned+34 condition × conditional bound10151. No player binding, acquisition or multiplayer acceptance claim.'}, null, 2));
console.log(`PASS: ${vectors} original movement vectors, ${rejected} original rejections, ${rows.length} conditional source vectors and missing-source refusals`);
