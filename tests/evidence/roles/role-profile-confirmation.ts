import type {RoleProfilePayload} from '../../../apps/server/src/accounts/profile/payload';

/** Original4249b6 →424908 →4209fb: success1 copies before reporting the result. */
export function applyRoleProfileConfirmation(profile: RoleProfilePayload,
    message: {result: number; profile: RoleProfilePayload},
    notify?: (result: number) => void): void {
  if (message.result === 1) {
    // Copy only original fields; vtable, string storage, header and padding remain intact.
    for (const [start, length] of [[4, 12], [0x10, 1], [0x14, 12], [0x58, 1],
      [0x5c, 4], [0x60, 0x108], [0x168, 3], [0x16c, 4]]) {
      profile.bytes.set(message.profile.bytes.subarray(start, start + length), start);
    }
    profile.strings[0] = message.profile.strings[0];
    profile.strings[1] = message.profile.strings[1];
  }
  notify?.(message.result);
}
