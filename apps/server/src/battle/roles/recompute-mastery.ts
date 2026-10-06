import type {OwnedRoleEquipmentRecord} from '../../../../shared/contracts/owned-equipment';
import type {RoleRecomputeValues} from './recompute-base';
import {applyRoleArmorMastery} from './recompute-armor';
import {applyRoleMovementMastery} from './recompute-movement';

/** Original433ad6–433c55: optional mastery decrement, type selection and gear bonuses. */
export function applyRoleRecomputeMastery(state: RoleRecomputeValues,
    equipment: OwnedRoleEquipmentRecord, tankType: number,
    scales: {move: number; turn: number},
    setMovement?: (selector: 10 | 11, value: number) => void): {move: number; turn: number} | undefined {
  const result = applyRoleMovementMastery(state.accumulators, equipment.fields.get(0x34)!, tankType, scales);
  if (!result) return undefined;
  const {mastery, speed: move, turn} = result;
  setMovement?.(10, move);
  setMovement?.(11, turn);
  // Original421c4b/421c7a: integer affine expression, then x87 percent × uint32 field.
  applyRoleArmorMastery(state, mastery, equipment.fields.get(0x3c)!, equipment.fields.get(0x4c)!);
  return {move, turn};
}
