/** CDTank.exe 46e0e3 / 46aaef: one shared X/Y phase per tank actor. */
export interface RoleTrackTextureState {
  readonly elapsed: number;
  readonly index: 0 | 1;
}

export function createRoleTrackTextureState(): RoleTrackTextureState {
  return {elapsed: 0, index: 0};
}

/** Only accepted straight and arced commands translate the actor; 0/3/4 freeze. */
export function roleTrackCommandMoves(command: number): boolean {
  return command === 1 || command === 2 || command === 5 || command === 6 ||
    command === 7 || command === 8;
}

/** Caller supplies the accepted-command gate, independently of visual actions. */
export function advanceRoleTrackTexture(
    state: RoleTrackTextureState, deltaSeconds: number): RoleTrackTextureState {
  const total = Math.fround(state.elapsed) + Math.fround(deltaSeconds);
  // Native x87 compares before rounding the stored float32 accumulator.
  if (total > Math.fround(0.1)) {
    return {elapsed: 0, index: state.index === 0 ? 1 : 0};
  }
  return {elapsed: Math.fround(total), index: state.index};
}
