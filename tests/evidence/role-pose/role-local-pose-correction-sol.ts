import {rolePoseHalfDegreeVector, type RolePoseVector} from './role-pose-command-sol.js';

export interface LocalRolePoseCorrectionProvider {
  readonly rolePresent: boolean;
  setCommand(command: number): void;
  setPosition(position: RolePoseVector): void;
  setLook(direction: RolePoseVector): void;
  setForward(direction: RolePoseVector): void;
  publishImmediatePose(): void;
  separateRoleOverlap(): void;
  cacheCommandBytes(bytes: Uint8Array): void;
  relativeSeconds(): number;
  writeCachedTime(seconds: number): void;
}

/** Original428167 accepts local states0/1, then caches the received nine words
 * after separation and replaces cached+0x18 with the local relative clock.
 * Provider owns role setters, OBB updates, actor publication and tree traversal.
 * The last two received words have no proven wire producer or speed effect here.
 */
export function applyLocalRolePoseCorrection(received: Uint8Array,
    provider: LocalRolePoseCorrectionProvider): boolean {
  if (!provider.rolePresent) {
    return false;
  }
  const view = new DataView(received.buffer, received.byteOffset, received.byteLength);
  const state = view.getUint32(4, true);
  if (state !== 0 && state !== 1) {
    return false;
  }
  provider.setCommand(view.getUint32(0, true));
  provider.setPosition([view.getFloat32(8, true), 0, view.getFloat32(12, true)]);
  provider.setLook(rolePoseHalfDegreeVector(view.getInt32(16, true)));
  provider.setForward(rolePoseHalfDegreeVector(view.getInt32(20, true)));
  provider.publishImmediatePose();
  provider.separateRoleOverlap();
  provider.cacheCommandBytes(received.slice(0, 36));
  provider.writeCachedTime(Math.fround(provider.relativeSeconds()));
  return true;
}
