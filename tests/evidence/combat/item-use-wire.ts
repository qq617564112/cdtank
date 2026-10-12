export const ITEM_USE_MESSAGE_TYPE = 0x3c9e;
export const ITEM_USE_BODY_BITS = 65;

export interface ItemUsePacket {
  instanceId: number;
  /** Original packet+0x10; business meaning remains unconfirmed. */
  field10: number;
  /** Original packet+0x14 serialized as one boolean bit. */
  field14: boolean;
}

/** Original43c7f0 body; message type is routed separately. */
export function encodeItemUse(packet: ItemUsePacket, startBit = 0): Uint8Array {
  const bytes = new Uint8Array(Math.ceil((startBit + ITEM_USE_BODY_BITS) / 8));
  const values = [packet.instanceId, packet.field10, Number(packet.field14)];
  let cursor = startBit;
  for (let field = 0; field < values.length; field++) {
    const width = field === 2 ? 1 : 32;
    for (let bit = 0; bit < width; bit++, cursor++) {
      bytes[cursor >>> 3] |= ((values[field] >>> bit) & 1) << (cursor & 7);
    }
  }
  return bytes;
}

/** Original43c83d zeroes32-bit destinations and normalizes the boolean byte. */
export function decodeItemUse(bytes: Uint8Array, startBit = 0): ItemUsePacket {
  if (startBit + ITEM_USE_BODY_BITS > bytes.length * 8) throw new RangeError('Incomplete item-use payload');
  const values: number[] = [];
  let cursor = startBit;
  for (const width of [32, 32, 1]) {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      value |= ((bytes[cursor >>> 3] >>> (cursor & 7)) & 1) << bit;
    }
    values.push(value >>> 0);
  }
  return {instanceId: values[0], field10: values[1], field14: values[2] === 1};
}
