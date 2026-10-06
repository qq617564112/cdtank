import type {OwnedRoleEquipmentRecord} from '../contracts/owned-equipment';

export interface OwnedTankTextures {
  U: number;
  M: number;
  XY: number;
}

/** Original4b67fc/4b68bf/4b6982: selected tanktexture IDs in owned record order. */
export function readOwnedTankTextures(record: OwnedRoleEquipmentRecord): OwnedTankTextures | undefined {
  const U = record.fields.get(0x28);
  const M = record.fields.get(0x2c);
  const XY = record.fields.get(0x30);
  if (U === undefined || M === undefined || XY === undefined) return undefined;
  return {U: U >>> 0, M: M >>> 0, XY: XY >>> 0};
}
