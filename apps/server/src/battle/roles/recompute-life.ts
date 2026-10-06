import type {CombatSkillDefinition} from '../../../../shared/combat/catalog';
import type {RoleDataScaleLimit} from './data-scale';
import {selectRoleSkills, type RoleSkillSources, type RoleItemSkills} from './skills';
import {roleSkillMultiplier} from './reload';

/** Original4334e8 initializes record+58 from actual owned pet+2c. */
export function initializeRoleLifeValue(ownedHp: number): number {
  return ownedHp | 0;
}

/** Original432951 wraps MaxHP multiplication and addition as int32. */
export function accumulateRoleLifeSkill(maxHp: number, skill: CombatSkillDefinition,
    multiplier: number): number {
  return (maxHp + Math.imul(skill.attributes.MaxHP, multiplier)) | 0;
}

/** Original4337d7 uses datascale1, upper bound before lower bound. */
export function limitRoleLifeValue(maxHp: number, limit: RoleDataScaleLimit): number {
  if (maxHp > limit.upper) maxHp = limit.upper;
  if (maxHp < limit.lower) maxHp = limit.lower;
  return maxHp;
}

/** Original433cf4 applies the VIP byte condition after the HP limit. */
export function convertRoleLifeValue(maxHp: number, vip: number,
    vipMultiplier: number | undefined): number {
  return (vip & 255) !== 0 ? Math.imul(maxHp, vipMultiplier!) : maxHp;
}

export interface RoleLifeRecomputeInput {
  /** Missing owned pet+2c is not a zero HP default. */
  ownedHp: number | undefined;
  sources: RoleSkillSources;
  skills: ReadonlyMap<number, CombatSkillDefinition>;
  items: ReadonlyMap<number, RoleItemSkills>;
  limits: ReadonlyMap<number, RoleDataScaleLimit>;
  roleValue9: number;
  vip: number | undefined;
  /** Required only for an actual nonzero VIP byte; its producer remains unresolved. */
  vipMultiplier: number | undefined;
}

/** Life eligibility does not depend on movement, attack, defense or owned lucky fields. */
export function recomputeQualifiedRoleLife(input: RoleLifeRecomputeInput): {
  maxHp: number; selectedSkillIds: number[];
} | undefined {
  const limit = input.limits.get(1);
  if (input.ownedHp === undefined || input.vip === undefined ||
      !input.sources.currentSkillIds || !limit ||
      ((input.vip & 255) !== 0 && input.vipMultiplier === undefined)) return undefined;
  let maxHp = initializeRoleLifeValue(input.ownedHp);
  const selected = selectRoleSkills(input.sources, input.skills, input.items);
  for (const skill of selected) {
    maxHp = accumulateRoleLifeSkill(maxHp, skill,
      roleSkillMultiplier(skill.triggerType, input.roleValue9, skill.functions[0]!.z));
  }
  maxHp = limitRoleLifeValue(maxHp, limit);
  return {maxHp: convertRoleLifeValue(maxHp, input.vip, input.vipMultiplier),
    selectedSkillIds: selected.map(skill => skill.skillId)};
}
