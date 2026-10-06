import type {RoleProfilePayload} from './payload';

/** Original42fe3f →4208b7 selector2: five owned part instances atpayload+148. */
export function readRoleProfileEquipment(profile: RoleProfilePayload): number[] {
  const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
  return Array.from({length: 5}, (_, slot) => view.getUint32(0x148 + slot * 4, true));
}

/** Original42fe47 →420916 selector2 replaces all five slots, without other writes. */
export function writeRoleProfileEquipment(profile: RoleProfilePayload, instances: readonly number[]): void {
  const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
  for (let slot = 0; slot < 5; slot++) view.setUint32(0x148 + slot * 4, instances[slot] >>> 0, true);
}
