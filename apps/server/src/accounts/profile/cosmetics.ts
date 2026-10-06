import type {RoleProfilePayload} from './payload';

/** Original scalar selector44 and first entry of array selector1. */
export function readRoleProfileCosmetics(profile: RoleProfilePayload): {
  skinInstanceId: number; markInstanceId: number;
} {
  const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
  return {skinInstanceId: view.getUint32(0x118, true), markInstanceId: view.getUint32(0x13c, true)};
}

/** Selector1's native setter copies three DWORDs; preserve its trailing two entries. */
export function writeRoleProfileCosmetic(profile: RoleProfilePayload, kind: 'skin' | 'mark',
    instanceId: number): void {
  const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
  view.setUint32(kind === 'skin' ? 0x118 : 0x13c, instanceId >>> 0, true);
}
