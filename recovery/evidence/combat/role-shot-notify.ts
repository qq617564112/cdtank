export const ROLE_BEFORE_SHOT_NOTIFY_TYPE = 0x3ac7;
export const ROLE_SHOT_NOTIFY_TYPE = 0x3aa2;

export interface RoleBeforeShotNotify {roleId: number}
export interface RoleShotNotify extends RoleBeforeShotNotify {
  itemId: number;
  x: number;
  y: number;
  z: number;
}

/** Original factories leave identifiers uninitialized; only shot XYZ is zeroed. */
export function createRoleBeforeShotNotify(): Partial<RoleBeforeShotNotify> {
  return {};
}

export function createRoleShotNotify(): Partial<RoleShotNotify> {
  return {x: 0, y: 0, z: 0};
}

function writeBits(source: Uint8Array, startBit: number): Uint8Array {
  const bytes = new Uint8Array(Math.ceil((startBit + source.length * 8) / 8));
  for (let bit = 0; bit < source.length * 8; bit++) {
    const destination = startBit + bit;
    bytes[destination >>> 3] |= ((source[bit >>> 3] >>> (bit & 7)) & 1) << (destination & 7);
  }
  return bytes;
}

function readBits(bytes: Uint8Array, length: number, startBit: number): DataView {
  if (startBit + length * 8 > bytes.length * 8) throw new RangeError('Incomplete shot notification payload');
  const source = new Uint8Array(length);
  for (let bit = 0; bit < length * 8; bit++) {
    const position = startBit + bit;
    source[bit >>> 3] |= ((bytes[position >>> 3] >>> (position & 7)) & 1) << (bit & 7);
  }
  return new DataView(source.buffer);
}

/** Original42571f/425ba6: raw roleId32, LSB-first. */
export function encodeRoleBeforeShotNotify(message: RoleBeforeShotNotify, startBit = 0): Uint8Array {
  const source = new Uint8Array(4);
  new DataView(source.buffer).setUint32(0, message.roleId, true);
  return writeBits(source, startBit);
}

export function decodeRoleBeforeShotNotify(bytes: Uint8Array, startBit = 0): RoleBeforeShotNotify {
  return {roleId: readBits(bytes, 4, startBit).getUint32(0, true)};
}

/** Original42cadf/42cb4f: XYZ float32, roleId32, low16 itemId, LSB-first. */
export function encodeRoleShotNotify(message: RoleShotNotify, startBit = 0): Uint8Array {
  const source = new Uint8Array(18);
  const view = new DataView(source.buffer);
  view.setFloat32(0, message.x, true);
  view.setFloat32(4, message.y, true);
  view.setFloat32(8, message.z, true);
  view.setUint32(12, message.roleId, true);
  view.setUint16(16, message.itemId, true);
  return writeBits(source, startBit);
}

export function decodeRoleShotNotify(bytes: Uint8Array, startBit = 0): RoleShotNotify {
  const view = readBits(bytes, 18, startBit);
  return {x: view.getFloat32(0, true), y: view.getFloat32(4, true), z: view.getFloat32(8, true),
    roleId: view.getUint32(12, true), itemId: view.getUint16(16, true)};
}
