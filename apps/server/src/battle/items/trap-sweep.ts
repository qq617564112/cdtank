import type {GroundTrapSnapshot} from '../../../../shared/protocols';
import {combatItems, combatSkills} from '../catalog';

export interface TrapSweepRule {
  itemTableId: 12;
  skillId: 12;
  radius: number;
}

/** Original definition only; XZ radius and ground-object eligibility are rebuilt. */
export function readTrapSweepRule(): TrapSweepRule | undefined {
  const item = combatItems.get(12);
  const skill = item ? combatSkills.get(item.skillIds[0]) : undefined;
  if (!item || item.itemType !== 1 || !skill || skill.skillId !== 12
      || skill.triggerType !== 1 || skill.target !== 1 || skill.functions[0]?.type !== 14
      || skill.range <= 0) return undefined;
  return {itemTableId: 12, skillId: 12, radius: skill.range};
}

/** Select supported active current-room traps; caller consumes before removing them. */
export function selectSweepTraps(traps: readonly GroundTrapSnapshot[],
    position: {x: number; z: number}, now: number, range: number): GroundTrapSnapshot[] {
  return traps.filter(trap => (trap.itemTableId === 3001 || trap.itemTableId === 3002 || trap.itemTableId === 3003 || trap.itemTableId === 3004 || trap.itemTableId === 3005) && now < trap.expiresAt
    && (trap.x - position.x) ** 2 + (trap.z - position.z) ** 2 <= range ** 2);
}
