/** CDTank.exe 46c239/46c23f and 46e0e3: per-actor XY texture phase. */
export interface RoleTrackTextureState {
  readonly elapsed: number;
  readonly index: 0 | 1;
}

export function createRoleTrackTextureState(): RoleTrackTextureState {
  return {elapsed: 0, index: 0};
}

/** Call only when the original 4660a5 target-movement gate permits +64 update. */
export function advanceRoleTrackTexture(
    state: RoleTrackTextureState, deltaSeconds: number): RoleTrackTextureState {
  const total = Math.fround(state.elapsed) + Math.fround(deltaSeconds);
  // x87 compares its sum before the float32 accumulator store is rounded.
  if (total > Math.fround(0.1)) {
    return {elapsed: 0, index: state.index === 0 ? 1 : 0};
  }
  return {elapsed: Math.fround(total), index: state.index};
}
