import {prepareRoleAmmoChangeUi, type RoleAmmoChangeUi} from '../combat/role-ammo-change-ui';
import {applyRoleAmmoChangeReloadNotification} from './reload';

export const ROLE_AMMO_CHANGE_MESSAGE_TYPE = 0x3ab5;
export const ROLE_AMMO_CHANGE_BODY_BITS = 96;
export interface RoleAmmoChangePacket {
  /** Original packet+c forwarded to owner+6c; business meaning remains unresolved. */
  field0c: number;
  /** Original packet+10 used by the optional UI inventory lookup. */
  field10: number;
  /** Original packet+14 copied into role+54. */
  seconds: number;
}

/** Original425f2c: raw DWORD, DWORD, float32 in LSB-first bitstream order. */
export function encodeRoleAmmoChange(packet: RoleAmmoChangePacket, startBit = 0): Uint8Array {
  const source = new Uint8Array(12);
  const view = new DataView(source.buffer);
  view.setUint32(0, packet.field0c >>> 0, true);
  view.setUint32(4, packet.field10 >>> 0, true);
  view.setFloat32(8, packet.seconds, true);
  const bytes = new Uint8Array(Math.ceil((startBit + ROLE_AMMO_CHANGE_BODY_BITS) / 8));
  for (let bit = 0; bit < ROLE_AMMO_CHANGE_BODY_BITS; bit++) {
    const destination = startBit + bit;
    bytes[destination >>> 3] |= ((source[bit >>> 3] >>> (bit & 7)) & 1) << (destination & 7);
  }
  return bytes;
}

/** Original42ebf8 reads all three32-bit fields into cleared destinations. */
export function decodeRoleAmmoChange(bytes: Uint8Array, startBit = 0): RoleAmmoChangePacket {
  if (startBit + ROLE_AMMO_CHANGE_BODY_BITS > bytes.length * 8) {
    throw new RangeError('Incomplete ammo-change payload');
  }
  const source = new Uint8Array(12);
  for (let bit = 0; bit < ROLE_AMMO_CHANGE_BODY_BITS; bit++) {
    const position = startBit + bit;
    source[bit >>> 3] |= ((bytes[position >>> 3] >>> (position & 7)) & 1) << (bit & 7);
  }
  const view = new DataView(source.buffer);
  return {field0c: view.getUint32(0, true), field10: view.getUint32(4, true), seconds: view.getFloat32(8, true)};
}

/** Decoded3ab5 → original optional UI gate → role reload confirmation. */
export function receiveRoleAmmoChange(
  bytes: Uint8Array,
  state: Parameters<typeof applyRoleAmmoChangeReloadNotification>[1],
  currentSeconds: () => number,
  observers: Parameters<typeof applyRoleAmmoChangeReloadNotification>[2],
  startBit = 0,
  ui?: RoleAmmoChangeUi,
): RoleAmmoChangePacket {
  const packet = decodeRoleAmmoChange(bytes, startBit);
  applyRoleAmmoChangeReloadNotification({...packet, currentSeconds}, state,
    ui ? {...observers, prepareUi: () => prepareRoleAmmoChangeUi(packet.field10, ui)} : observers);
  return packet;
}

/** Original4038d5/4027c3 envelope for an incoming server confirmation.
 * The same type in the outgoing direction has a64-bit request body; callers
 * must select this receiver by direction, not by message type alone.
 */
export function receiveRoleAmmoChangeEnvelope(
  bytes: Uint8Array,
  state: Parameters<typeof receiveRoleAmmoChange>[1],
  currentSeconds: () => number,
  observers: Parameters<typeof receiveRoleAmmoChange>[3],
  ui?: RoleAmmoChangeUi,
): {identity: number; packet: RoleAmmoChangePacket} {
  if (bytes.length < 4) throw new RangeError('Incomplete ammo-change envelope');
  const header = new DataView(bytes.buffer, bytes.byteOffset, 4);
  if (header.getUint16(0, true) !== ROLE_AMMO_CHANGE_MESSAGE_TYPE) {
    throw new RangeError('Unexpected ammo-change message type');
  }
  const identity = header.getUint16(2, true);
  const packet = receiveRoleAmmoChange(bytes, state, currentSeconds, observers, 32, ui);
  return {identity, packet};
}
