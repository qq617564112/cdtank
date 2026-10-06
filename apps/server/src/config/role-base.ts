import type {RoleTankBaseDefinition, RolePetBaseDefinition} from '../../../shared/contracts/role-base';

/** Original43b62a table loader and4334e8 recompute field mapping. */
export function readRoleTankBase(values: Readonly<Record<string, string>>): RoleTankBaseDefinition {
  return {
    id: Number(values.ID) | 0,
    tankType: Number(values.TankType) | 0,
    field84: Number(values.TankMove) | 0,
    field88: Number(values.TankTurn) | 0,
    reloadDuration: Math.fround(Number(values.TankDelay)),
    field90: Number(values.TankBullet) | 0,
    fieldA4: Number(values.SideDef) | 0,
    fieldA8: Number(values.BackDef) | 0,
  };
}

/** Original43a91c: columns16–19 initialize the four mastery accumulators. */
export function readRolePetBase(values: Readonly<Record<string, string>>): RolePetBaseDefinition {
  return {id: Number(values.ID) | 0, field7c: Number(values.STankMastery) | 0,
    field80: Number(values.MTankMastery) | 0, field84: Number(values.LTankMastery) | 0,
    field88: Number(values.STugMastery) | 0};
}
