import type {CombatSkillDefinition} from '../../../../shared/combat/catalog';
import {roleSkillMultiplier} from './reload';
import type {RoleRecomputeValues} from './recompute-base';
import {accumulateRoleArmorAttribute} from './recompute-armor';
import {accumulateRoleAmmoSkill} from './recompute-ammo';
import {accumulateRoleLifeSkill} from './recompute-life';
import {accumulateRoleMovementSkill} from './recompute-movement';

/** Complete432951: integer products wrap before float addition except Atk/BackDef. */
export function accumulateRoleRecomputeSkill(
  state: RoleRecomputeValues,
  skill: CombatSkillDefinition | undefined,
  roleValue9: number,
): void {
  if (!skill) return;
  const attributes = skill.attributes;
  const multiplier = roleSkillMultiplier(skill.triggerType, roleValue9, skill.functions[0]!.z);
  const floatAdd = (offset: number, value: number): void => {
    state.roleFloats.set(offset, Math.fround(state.roleFloats.get(offset)! + value));
  };
  const integerAdd = (target: Map<number, number>, offset: number, value: number): void => {
    target.set(offset, (target.get(offset)! + Math.imul(value, multiplier)) | 0);
  };
  accumulateRoleArmorAttribute(state, skill, multiplier, 'Atk');
  accumulateRoleArmorAttribute(state, skill, multiplier, 'AtkBase');
  accumulateRoleArmorAttribute(state, skill, multiplier, 'AtkBonus');
  accumulateRoleArmorAttribute(state, skill, multiplier, 'BackDef');
  floatAdd(0x68, Math.imul(attributes.Critical, multiplier));
  accumulateRoleArmorAttribute(state, skill, multiplier, 'Def');
  accumulateRoleArmorAttribute(state, skill, multiplier, 'DefBonus');
  accumulateRoleAmmoSkill(state, skill, multiplier);
  floatAdd(0x94, Math.imul(attributes.HPDrain, multiplier));
  floatAdd(0x8c, Math.imul(attributes.HPRegainRate, multiplier));
  floatAdd(0x6c, Math.imul(attributes.Lucky, multiplier));
  integerAdd(state.roleIntegers, 0x58, attributes.MaxCounter);
  state.recordFields.set(0x58, accumulateRoleLifeSkill(state.recordFields.get(0x58)!, skill, multiplier));
  accumulateRoleMovementSkill(state.accumulators, skill, multiplier);
  accumulateRoleArmorAttribute(state, skill, multiplier, 'SideDef');
  floatAdd(0x90, Math.imul(attributes.StunRate, multiplier));
}
