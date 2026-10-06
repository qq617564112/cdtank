import type {RoleRecomputeTankBase} from '../../../../shared/contracts/role-base';
import type {CombatSkillDefinition} from '../../../../shared/combat/catalog';
import type {RoleDataScaleLimit} from './data-scale';
import {selectRoleSkills, type RoleSkillSources, type RoleItemSkills} from './skills';
import {roleSkillMultiplier} from './reload';

export interface RoleAmmoValues {
  recordFields: Map<number, number>;
  roleFloats: Map<number, number>;
}

/** Original432951 ammo fields, with integer products before float32 addition. */
export function accumulateRoleAmmoSkill(state: RoleAmmoValues, skill: CombatSkillDefinition,
    multiplier: number): void {
  for (const [offset, value] of [[0x50, skill.attributes.Delay], [0x54, skill.attributes.LoadTime]]) {
    state.roleFloats.set(offset, Math.fround(state.roleFloats.get(offset)! + Math.imul(value, multiplier)));
  }
  state.recordFields.set(0x38, (state.recordFields.get(0x38)!
    + Math.imul(skill.attributes.MaxBullet, multiplier)) | 0);
}

/** Original4337d7 limits16/17; capacity is independent of owned HP and VIP. */
export function limitRoleAmmoValues(state: RoleAmmoValues,
    limits: ReadonlyMap<number, RoleDataScaleLimit>): void {
  for (const [target, offset, id] of [[state.roleFloats, 0x50, 16],
    [state.recordFields, 0x38, 17]] as const) {
    const {upper, lower} = limits.get(id)!;
    let value = target.get(offset)!;
    if (value > upper) value = upper;
    if (value < lower) value = lower;
    target.set(offset, value);
  }
}

/** Original433c55: retain the extended intermediate for last-round conversion. */
export function convertRoleAmmoValues(state: RoleAmmoValues): void {
  const scaled = state.roleFloats.get(0x50)! * Math.fround(.1);
  state.roleFloats.set(0x50, Math.fround(scaled));
  state.roleFloats.set(0x54, Math.fround(scaled * state.roleFloats.get(0x54)! * Math.fround(.03)));
}

/** Resolve only ammo dependencies, using the same source selector as433466. */
export function recomputeRoleAmmo(input: {
  tank: RoleRecomputeTankBase;
  sources: RoleSkillSources;
  skills: ReadonlyMap<number, CombatSkillDefinition>;
  items: ReadonlyMap<number, RoleItemSkills>;
  limits: ReadonlyMap<number, RoleDataScaleLimit>;
  roleValue9: number;
}): {capacity: number; normalSeconds: number; lastBulletSeconds: number;
    selectedSkillIds: number[]} | undefined {
  if (!input.sources.currentSkillIds) return undefined;
  const state: RoleAmmoValues = {
    recordFields: new Map([[0x38, input.tank.field90 | 0]]),
    roleFloats: new Map([[0x50, Math.fround(input.tank.reloadDuration)], [0x54, 0]]),
  };
  const selected = selectRoleSkills(input.sources, input.skills, input.items);
  for (const skill of selected) {
    accumulateRoleAmmoSkill(state, skill,
      roleSkillMultiplier(skill.triggerType, input.roleValue9, skill.functions[0]!.z));
  }
  limitRoleAmmoValues(state, input.limits);
  convertRoleAmmoValues(state);
  return {capacity: state.recordFields.get(0x38)!, normalSeconds: state.roleFloats.get(0x50)!,
    lastBulletSeconds: state.roleFloats.get(0x54)!, selectedSkillIds: selected.map(skill => skill.skillId)};
}
