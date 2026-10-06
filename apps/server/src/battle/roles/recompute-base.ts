import type {OwnedRoleBaseRecord} from '../../../../shared/contracts/owned-base';
import type {OwnedRoleEquipmentRecord} from '../../../../shared/contracts/owned-equipment';

import type {RoleRecomputeTankBase, RoleRecomputePetBase} from '../../../../shared/contracts/role-base';
import {initializeRoleArmorValues} from './recompute-armor';
import {initializeRoleLifeValue} from './recompute-life';
import {initializeRoleMovementValues} from './recompute-movement';

export interface RoleRecomputeValues {
  recordFields: Map<number, number>;
  roleIntegers: Map<number, number>;
  roleFloats: Map<number, number>;
  accumulators: number[];
}

/** Original4334e8–4335b2 resets the base fields before skill/item traversal. */
export function initializeRoleRecomputeBase(
  base: OwnedRoleBaseRecord,
  equipment: OwnedRoleEquipmentRecord,
  tank: RoleRecomputeTankBase,
  pet: RoleRecomputePetBase,
): RoleRecomputeValues {
  const armor = initializeRoleArmorValues(equipment.fields.get(0x40)!, equipment.fields.get(0x50)!, tank);
  return {
    recordFields: new Map([[0x58, initializeRoleLifeValue(base.fields.get(0x2c)!)], [0x38, tank.field90 | 0]]),
    roleIntegers: new Map([...armor.roleIntegers, [0x58, 0]]),
    roleFloats: new Map([[0x8c, 0], [0x94, 0],
      [0x68, Math.fround(base.fields.get(0x34)! | 0)],
      [0x6c, Math.fround(base.fields.get(0x3c)! | 0)], ...armor.roleFloats,
      [0x54, 0], [0x50, Math.fround(tank.reloadDuration)], [0x90, 0]]),
    // Stack locals: -10, argument8, -8, -c, -4, argument18.
    accumulators: initializeRoleMovementValues(tank, pet),
  };
}
