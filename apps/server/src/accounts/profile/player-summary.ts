import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import type {RoleProfilePayload} from './payload';

/** Original MyPlayer getters read signed values from the recovered profile payload. */
export function readRoleProfilePlayerSummary(profile: RoleProfilePayload):
  NonNullable<ResRoleProfile['playerSummary']> {
  const view = new DataView(profile.bytes.buffer, profile.bytes.byteOffset, profile.bytes.byteLength);
  return {score: view.getInt32(0x5c, true), originality: view.getInt32(0x9c, true),
    tech: view.getInt32(0xa0, true)};
}
