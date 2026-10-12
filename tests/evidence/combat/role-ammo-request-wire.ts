/** Client → server3ab5 uses a different body from the server confirmation. */
export const ROLE_AMMO_REQUEST_MESSAGE_TYPE = 0x3ab5;
export const ROLE_AMMO_REQUEST_BODY_BITS = 64;

export interface RoleAmmoRequestPacket {
  slot: number;
  /** Preserved packet+10 memory; no default or business meaning is established. */
  field10: number;
}

function validateOffset(startBit: number): void {
  if (!Number.isSafeInteger(startBit) || startBit < 0) {
    throw new RangeError('Invalid ammo-request bit offset');
  }
}

/** Original521a15 writes two raw DWORDs in LSB-first order. */
export function encodeRoleAmmoRequest(packet: RoleAmmoRequestPacket, startBit = 0): Uint8Array {
  validateOffset(startBit);
  const source = new Uint8Array(8);
  const view = new DataView(source.buffer);
  view.setUint32(0, packet.slot >>> 0, true);
  view.setUint32(4, packet.field10 >>> 0, true);
  const bytes = new Uint8Array(Math.ceil((startBit + ROLE_AMMO_REQUEST_BODY_BITS) / 8));
  for (let bit = 0; bit < ROLE_AMMO_REQUEST_BODY_BITS; bit++) {
    const destination = startBit + bit;
    bytes[destination >>> 3] |= ((source[bit >>> 3] >>> (bit & 7)) & 1) << (destination & 7);
  }
  return bytes;
}

/** Original42595f reads two DWORDs; field10 must remain available to callers. */
export function decodeRoleAmmoRequest(bytes: Uint8Array, startBit = 0): RoleAmmoRequestPacket {
  validateOffset(startBit);
  if (startBit + ROLE_AMMO_REQUEST_BODY_BITS > bytes.length * 8) {
    throw new RangeError('Incomplete ammo-request payload');
  }
  const source = new Uint8Array(8);
  for (let bit = 0; bit < ROLE_AMMO_REQUEST_BODY_BITS; bit++) {
    const position = startBit + bit;
    source[bit >>> 3] |= ((bytes[position >>> 3] >>> (position & 7)) & 1) << (bit & 7);
  }
  const view = new DataView(source.buffer);
  return {slot: view.getUint32(0, true), field10: view.getUint32(4, true)};
}
