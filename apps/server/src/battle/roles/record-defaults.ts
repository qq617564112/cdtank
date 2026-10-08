import {defaultAmmoId} from '../../../../shared/content/catalog';
/** Numeric payload writes in original OdlPlayer constructor523333–52339b. */
export function createRoleRecordNumericDefaults(): Map<number, number> {
  return new Map([
    [0xc, 0], [0x10, 1], [0x14, 0], [0x34, 1], [0x38, 0], [0x3c, 1],
    [0x40, defaultAmmoId()], [0x44, 0], [0x48, 0], [0x4c, 0], [0x50, 0],
    [0x54, 0], [0x58, 0], [0x5c, 0], [0x60, 0], [0x64, 0], [0x68, 0],
    [0x6c, 0], [0x70, 0], [0x74, 0], [0x78, 0], [0x7c, 0], [0x80, 0],
    [0x84, 0], [0x88, 0], [0x8c, 0], [0x90, 0],
  ]);
}

/** Initial bytes in CDTank.exe at61e494/61e498, read by the mastery tail. */
export const ROLE_INITIAL_MOVEMENT_SCALES = Object.freeze({move: 10,
  turn: Math.fround(0.06981316953897476)});
