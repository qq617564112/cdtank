import {itemForHandler, itemTrapHandler} from '../../../../shared/content/catalog';
import type {GroundTrapSnapshot} from '../../../../shared/protocols';
import {combatItems, combatSkills} from '../catalog';

export interface TrapSweepRule {
  itemTableId: number;
  skillId: number;
  radius: number;
}

/** Original definition only; XZ radius and ground-object eligibility are rebuilt. */
export function readTrapSweepRule(itemId = itemForHandler('use', 'trapSweep').id): TrapSweepRule | undefined {
  const item = combatItems.get(itemId);
  const skill = item ? combatSkills.get(item.skillIds[0]) : undefined;
  if (!item || item.itemType !== 1 || !skill
      || skill.triggerType !== 1 || skill.target !== 1 || skill.functions[0]?.type !== 14
      || skill.range <= 0) return undefined;
  return {itemTableId: item.itemTableId, skillId: skill.skillId, radius: skill.range};
}

/** Select supported active current-room traps; caller consumes before removing them. */
export function selectSweepTraps(traps: readonly GroundTrapSnapshot[],
    position: {x: number; z: number}, now: number, range: number): GroundTrapSnapshot[] {
  return traps.filter(trap => !!itemTrapHandler(trap.itemTableId) && now < trap.expiresAt
    && (trap.x - position.x) ** 2 + (trap.z - position.z) ** 2 <= range ** 2);
}
