import type {RoleDataScaleLimit} from './data-scale';
import type {RoleRecomputeValues} from './recompute-base';
import {limitRoleArmorValue, convertRoleArmorValues} from './recompute-armor';
import {limitRoleAmmoValues, convertRoleAmmoValues} from './recompute-ammo';
import {limitRoleLifeValue, convertRoleLifeValue} from './recompute-life';
import {limitRoleMovementValues} from './recompute-movement';

/** Original4337d7–433ad6 applies upper bounds first, then lower bounds. */
export function limitRoleRecomputeValues(state: RoleRecomputeValues,
    limits: ReadonlyMap<number, RoleDataScaleLimit>): void {
  const fields: readonly [Map<number, number>, number, number][] = [
    [state.roleFloats, 0x8c, 3],
    [state.roleFloats, 0x94, 4], [state.roleFloats, 0x68, 5],
    [state.roleFloats, 0x6c, 6], [state.roleIntegers, 0x70, 7],
    [state.roleFloats, 0x74, 8], [state.roleIntegers, 0x78, 9],
    [state.roleFloats, 0x7c, 10], [state.roleIntegers, 0x88, 11],
    [state.roleFloats, 0x84, 13], [state.roleFloats, 0x80, 12],
    [state.roleIntegers, 0x58, 20], [state.roleFloats, 0x90, 22],
  ];
  state.recordFields.set(0x58, limitRoleLifeValue(state.recordFields.get(0x58)!, limits.get(1)!));
  for (const [target, offset, id] of fields) {
    if (id >= 7 && id <= 13) {
      limitRoleArmorValue(target, offset, limits.get(id)!);
      continue;
    }
    const {upper, lower} = limits.get(id)!;
    let value = target.get(offset)!;
    if (value > upper) value = upper;
    if (value < lower) value = lower;
    target.set(offset, value);
  }
  limitRoleAmmoValues(state, limits);
  limitRoleMovementValues(state.accumulators, limits);
}

/** Original433c55–433cf4: percentage conversion, both reloads, then VIP MaxHP. */
export function convertRoleRecomputeValues(state: RoleRecomputeValues,
    vip: number, vipMultiplier: number): void {
  for (const offset of [0x94, 0x90, 0x6c, 0x68, 0x8c]) {
    state.roleFloats.set(offset, Math.fround(state.roleFloats.get(offset)! * Math.fround(.01)));
  }
  convertRoleArmorValues(state);
  convertRoleAmmoValues(state);
  state.recordFields.set(0x58, convertRoleLifeValue(state.recordFields.get(0x58)!, vip, vipMultiplier));
}
