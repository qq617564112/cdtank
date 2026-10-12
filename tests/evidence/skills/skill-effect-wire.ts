import type {PlaySkillEffectMessage, StopSkillEffectMessage} from '../../../apps/shared/protocols/MsgRoomEvent';

export const PLAY_SKILL_EFFECT_MESSAGE_TYPE = 0x4170;
export const STOP_SKILL_EFFECT_MESSAGE_TYPE = 0x4171;

function encodeFields(values: readonly number[], widths: readonly number[], startBit: number): Uint8Array {
  const bits = widths.reduce((sum, width) => sum + width, startBit);
  const bytes = new Uint8Array(Math.ceil(bits / 8));
  let cursor = startBit;
  for (let index = 0; index < widths.length; index++) {
    for (let bit = 0; bit < widths[index]; bit++, cursor++) {
      bytes[cursor >>> 3] |= ((values[index] >>> bit) & 1) << (cursor & 7);
    }
  }
  return bytes;
}

function decodeFields(bytes: Uint8Array, widths: readonly number[], startBit: number): number[] {
  if (widths.reduce((sum, width) => sum + width, startBit) > bytes.length * 8) {
    throw new RangeError('Incomplete skill effect message');
  }
  let cursor = startBit;
  return widths.map(width => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      value |= ((bytes[cursor >>> 3] >>> (cursor & 7)) & 1) << bit;
    }
    return value >>> 0;
  });
}

/** Original4893cb;132 bits, excluding the separate message type. */
export function encodePlaySkillEffect(message: PlaySkillEffectMessage, startBit = 0): Uint8Array {
  return encodeFields([message.skillId, message.effectIndex, message.duration, message.roleId,
    message.xBits, message.zBits], [16, 4, 16, 32, 32, 32], startBit);
}

/** Original48944e; effectIndex selects Effect1/2/3 with zero-based indexing. */
export function decodePlaySkillEffect(bytes: Uint8Array, startBit = 0): PlaySkillEffectMessage {
  const [skillId, effectIndex, duration, roleId, xBits, zBits] = decodeFields(bytes,
    [16, 4, 16, 32, 32, 32], startBit);
  return {skillId, effectIndex, duration, roleId, xBits, zBits};
}

/** Original4895be; no effect selector or instance handle is transmitted. */
export function encodeStopSkillEffect(message: StopSkillEffectMessage, startBit = 0): Uint8Array {
  return encodeFields([message.skillId, message.roleId], [16, 32], startBit);
}

/** Original4895f2. */
export function decodeStopSkillEffect(bytes: Uint8Array, startBit = 0): StopSkillEffectMessage {
  const [skillId, roleId] = decodeFields(bytes, [16, 32], startBit);
  return {skillId, roleId};
}
