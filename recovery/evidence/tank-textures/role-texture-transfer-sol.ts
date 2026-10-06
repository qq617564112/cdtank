import type {OwnedTankTextures} from '../../../apps/shared/combat/role-owned-textures';
import type {RoleTankTextureConfirmation} from '../../../apps/shared/contracts/tank-textures';

/** Original4993a4: six unsigned32 fields followed by an unsigned8 result. */
export function readRoleTankTextureConfirmation(reader: {
  unsigned(width: number): number;
}): RoleTankTextureConfirmation {
  return {
    instanceId: reader.unsigned(32) >>> 0,
    textures: {U: reader.unsigned(32) >>> 0, M: reader.unsigned(32) >>> 0,
      XY: reader.unsigned(32) >>> 0},
    tokens: reader.unsigned(32) >>> 0,
    money: reader.unsigned(32) >>> 0,
    result: reader.unsigned(8) & 0xff,
  };
}

/** Original492a89: request3f98 carries the instance and U/M/XY as four unsigned32s. */
export function writeRoleTankTextureRequest(writer: {
  unsigned(value: number, width: number): void;
}, instanceId: number, textures: OwnedTankTextures): void {
  for (const value of [instanceId, textures.U, textures.M, textures.XY]) {
    writer.unsigned(value >>> 0, 32);
  }
}
