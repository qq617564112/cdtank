import {combatItems, combatSkills} from '../catalog';

export const GROUP_TRAP_ITEM_ID = 3007;

export interface GroupTrapLaneRule {
  effectSkillId: number;
  triggerRadius: number;
  restraintDurationMs: number;
}

export interface GroupTrapRule {
  itemTableId: typeof GROUP_TRAP_ITEM_ID;
  placementSkillId: number;
  groundModelId: number;
  groundDurationMs: number;
  move: GroupTrapLaneRule;
  turn: GroupTrapLaneRule;
  fire: GroupTrapLaneRule;
}

function readLane(skillId: number | undefined, functionType: 3 | 4 | 5): GroupTrapLaneRule | undefined {
  const skill = skillId === undefined ? undefined : combatSkills.get(skillId);
  const restraint = skill?.functions[0];
  if (!skill || skill.triggerType !== 1 || skill.target !== 3 || skill.range !== 80
      || !restraint || restraint.type !== functionType || restraint.t !== 5) return undefined;
  return {effectSkillId: skill.skillId, triggerRadius: skill.range,
    restraintDurationMs: restraint.t * 1000};
}

/** Exact 3007 group-trap route; every source field is required before stock is consumed. */
export function readGroupTrapRule(itemTableId = GROUP_TRAP_ITEM_ID): GroupTrapRule | undefined {
  if (itemTableId !== GROUP_TRAP_ITEM_ID) return undefined;
  const item = combatItems.get(itemTableId);
  const roles = item?.runtime.skillRoles;
  const groundDurationMs = item?.runtime.values.groundDurationMs;
  if (!item || item.itemType !== 4 || item.category !== 4 || item.runtime.trap !== 'groupRestraint'
      || item.resources.modelId !== 9 || roles?.primary !== 4024
      || roles.secondary !== 4025 || roles.tertiary !== 4026
      || !Number.isFinite(groundDurationMs) || groundDurationMs <= 0) return undefined;
  const move = readLane(roles.primary, 3);
  const turn = readLane(roles.secondary, 4);
  const fire = readLane(roles.tertiary, 5);
  if (!move || !turn || !fire) return undefined;
  return {itemTableId, placementSkillId: roles.primary, groundModelId: item.resources.modelId,
    groundDurationMs, move, turn, fire};
}
