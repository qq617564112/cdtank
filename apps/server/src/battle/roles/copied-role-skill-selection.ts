import type {RankedRoleSkill} from './skills';

export function selectCopiedRoleSkill(candidates: readonly RankedRoleSkill[],
  roll: number): RankedRoleSkill | undefined {
  return candidates[Math.floor(roll * candidates.length)];
}
