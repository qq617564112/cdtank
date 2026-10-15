/** Each track retains its phase while stopped or changing actor actions. */
export interface RoleTrackTextureState {
  elapsed: number;
  index: number;
}

export function createRoleTrackTextureState(): RoleTrackTextureState {
  return {elapsed: 0, index: 0};
}

/** Only accepted straight and arced commands translate the actor; 0/3/4 freeze. */
export function roleTrackCommandMoves(command: number): boolean {
  return command === 1 || command === 2 || command === 5 || command === 6 ||
    command === 7 || command === 8;
}

/** X is the left track in native role space; pivot turns drive opposite directions. */
export function roleTrackDirection(command: number, part: 'X' | 'Y'): -1 | 0 | 1 {
  if (command === 3) return part === 'X' ? -1 : 1;
  if (command === 4) return part === 'X' ? 1 : -1;
  if (command === 1 || command === 5 || command === 6) return 1;
  if (command === 2 || command === 7 || command === 8) return -1;
  return 0;
}

/** Keep elapsed remainder and advance every crossed frame, including reverse playback. */
export function advanceRoleTrackTexture(
    state: RoleTrackTextureState, deltaSeconds: number, frameCount: number,
    frameDuration: number, direction: -1 | 0 | 1): RoleTrackTextureState {
  if (direction === 0) return state;
  const result = createRoleTrackTextureState();
  advanceRoleTrackTextureToRef(state, deltaSeconds, frameCount, frameDuration, direction, result);
  return result;
}

export function advanceRoleTrackTextureToRef(state: RoleTrackTextureState,
  deltaSeconds: number, frameCount: number, frameDuration: number,
  direction: -1 | 0 | 1, result: RoleTrackTextureState): void {
  if (direction === 0) {
    result.elapsed = state.elapsed; result.index = state.index;
    return;
  }
  const total = state.elapsed + deltaSeconds;
  const steps = Math.floor(total / frameDuration);
  const index = ((state.index + steps * direction) % frameCount + frameCount) % frameCount;
  result.elapsed = total - steps * frameDuration;
  result.index = index;
}
