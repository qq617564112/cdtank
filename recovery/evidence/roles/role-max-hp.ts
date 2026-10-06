import {roleSkillMultiplier} from '../../../apps/server/src/battle/roles/reload';

export interface RoleMaxHpSkill {
  triggerType: number;
  funcZ1: number;
  maxHp: number;
}

/** Original432951 adds signed32(MaxHP × multiplier) to record+58. */
export function accumulateRoleMaxHp(base: number, skill: RoleMaxHpSkill, roleValue9: number): number {
  const multiplier = roleSkillMultiplier(skill.triggerType, roleValue9, skill.funcZ1);
  return ((base | 0) + Math.imul(skill.maxHp | 0, multiplier)) | 0;
}

/** Original recompute caps first, then applies role+98 when record m_bVIP is nonzero. */
export function finishRoleMaxHp(
  accumulated: number, limits: {lower: number; upper: number}, vip: number, vipMultiplier: number,
): number {
  let value = accumulated | 0;
  if (value > (limits.upper | 0)) value = limits.upper | 0;
  if (value < (limits.lower | 0)) value = limits.lower | 0;
  return (vip & 255) !== 0 ? Math.imul(value, vipMultiplier | 0) : value;
}
