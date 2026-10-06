import type {RoleProfileUpdateMessage} from './role-profile-update';

/** Original42da6a →42d6cd: byte block then two zero-extended8-bit fields. */
export function decodeRoleProfileUpdate(bytes: Uint8Array, startBit = 0):
    {message: RoleProfileUpdateMessage; endBit: number} {
  let cursor = startBit;
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      const byte = bytes[cursor >>> 3];
      if (byte === undefined) throw new RangeError('Incomplete role profile update');
      value += ((byte >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  const count = unsigned(32);
  if (count >= 4096) throw new RangeError('Role profile update exceeds original block capacity');
  const profileBytes = new Uint8Array(count);
  for (let index = 0; index < count; index++) profileBytes[index] = unsigned(8);
  const code = unsigned(8), result = unsigned(8);
  return {message: {profileBytes, code, result}, endBit: cursor};
}
