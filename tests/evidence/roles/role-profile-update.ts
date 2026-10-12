import type {RoleProfilePayload} from '../../../apps/server/src/accounts/profile/payload';

/** Original42fd34 →41fa67: replace transmitted fields, retaining untransmitted storage. */
export function readRoleProfilePacket(profile: RoleProfilePayload, bytes: Uint8Array,
    startBit: number, decodeString: (bytes: Uint8Array) => string): number {
  let cursor = startBit;
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      const byte = bytes[cursor >>> 3];
      if (byte === undefined) throw new RangeError('Incomplete role profile');
      value += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
  const field = (offset: number): void => {view.setUint32(offset, unsigned(32), true);};
  const name = (): string => {
    const count = unsigned(32);
    const raw = new Uint8Array(count);
    for (let index = 0; index < count; index++) raw[index] = unsigned(8);
    return decodeString(raw);
  };
  field(0x80);
  field(0x84);
  profile.strings[0] = name();
  profile.bytes[0x58] = unsigned(1);
  profile.strings[1] = name();
  for (const offset of [0x68, 0x6c, 0x70, 0x74, 0x3c, 0x78, 0x7c, 0x80, 0x84, 0x88,
    0x8c, 0x94, 0x90, 0x98, 0x9c, 0xa0, 0xa4, 0xa8, 0xac, 0xb8, 0xbc, 0xc0, 0xc4,
    0xc8, 0xcc, 0xd0, 0xd4, 0xd8, 0xdc, 0xe0, 0xe4]) {
    field(0x20 + offset);
  }
  for (let index = 0; index < 32; index++) profile.bytes[0x60 + index] = unsigned(8);
  for (let offset = 0xe8; offset < 0x148; offset += 4) field(0x20 + offset);
  field(4);
  field(8);
  return cursor;
}

export interface RoleProfileUpdateMessage {
  code: number;
  result: number;
  profileBytes: Uint8Array;
}

/** Original42662d: code1 clears inventory state before decoding; code3 only reports result. */
export function applyRoleProfileUpdate(
    groups: readonly (readonly {state: number}[])[], profile: RoleProfilePayload,
    message: RoleProfileUpdateMessage, decodeString: (bytes: Uint8Array) => string,
    callbacks: ReadonlyMap<number, (value: number) => void>): void {
  if (message.code === 1) {
    for (const group of [2, 3, 4]) {
      for (const record of groups[group]) record.state = 0;
    }
  }
  if (message.code !== 3) readRoleProfilePacket(profile, message.profileBytes, 0, decodeString);
  if ([0, 1, 2, 3, 4, 5, 7, 8].includes(message.code)) {
    callbacks.get(message.code)?.(message.code === 3 ? message.result >>> 0 : 1);
  }
}
