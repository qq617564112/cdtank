import type {NavigationGrid} from './navigation';

/**
 * Vertical motion is an explicit project rule. The original movement
 * entrypoints at 0x433190 and 0x433073 only dispatch horizontal movement and
 * rebuild the horizontal OBB matrix; they do not contain a Y integrator.
 */
export interface TankVerticalState {
  /** Vertical velocity in source units per second. */
  velocity: number;
  /** True while the body is not resting on the continuous NAV surface. */
  airborne: boolean;
}

export interface TankVerticalStep {
  state: TankVerticalState;
  /** False when a horizontal candidate needs more than the adopted step height. */
  accepted: boolean;
}

/** Step and updated state are borrowed until this storage is used again. */
export class TankVerticalWorkspace {
  readonly updatedState: TankVerticalState = {velocity: 0, airborne: false};
  readonly result: TankVerticalStep = {state: this.updatedState, accepted: true};
}

export const TANK_GRAVITY = 600;
export const TANK_MAX_STEP_HEIGHT = 18;
export const TANK_GROUND_SNAP = 0.5;
export const TANK_MAX_FALL_SPEED = 900;

const f = Math.fround;

export function initialTankVerticalState(y: number, ground: number | undefined): TankVerticalState {
  if (ground !== undefined && y <= ground + TANK_GROUND_SNAP) {
    return {velocity: 0, airborne: false};
  }
  return {velocity: 0, airborne: ground !== undefined || y > 0};
}

/**
 * Advance the vertical component independently from the horizontal kernel.
 * Horizontal acceptance and collision rejection still call this function, so
 * a blocked tank falls and settles without changing X/Z.
 * A supplied sampledHeight must come from groundHeightAt at this position on
 * the current grid. Undefined keeps the ordinary lookup after passage checks.
 */
export function advanceTankVertical(position: {x: number; y: number; z: number},
  navigation: NavigationGrid | undefined, state: TankVerticalState, dt: number,
  horizontalRise = 0, sampledHeight?: number, workspace?: TankVerticalWorkspace): TankVerticalStep {
  if (!navigation) return verticalResult(state, true, workspace);
  if (!navigation.isValidAt(position.x, position.z)) return verticalResult(state, true, workspace);
  const height = sampledHeight ?? navigation.groundHeightAt(position.x, position.z);
  if (height === undefined) return verticalResult(state, true, workspace);
  const ground = f(height);
  const y = f(position.y);
  if (!(dt > 0)) {
    if (y < ground - TANK_GROUND_SNAP) {
      position.y = ground;
      return verticalResult(updatedVerticalState(0, false, workspace), true, workspace);
    }
    return verticalResult(state, true, workspace);
  }
  const rise = Math.max(0, horizontalRise);
  // A grounded body cannot climb a NAV surface step taller than the adopted
  // limit; the horizontal candidate is refused so X/Z stay on the old cell.
  if (!state.airborne && state.velocity <= 0 && rise > TANK_MAX_STEP_HEIGHT) {
    return verticalResult(state, false, workspace);
  }
  // A grounded body follows small descents as well as climbs. Crossing a NAV
  // cell must not make a continuous downhill surface trigger free fall.
  if (state.velocity <= 0 && (y <= ground + TANK_GROUND_SNAP
      || !state.airborne && y - ground <= TANK_MAX_STEP_HEIGHT)) {
    position.y = ground;
    return verticalResult(updatedVerticalState(0, false, workspace), true, workspace);
  }
  let velocity = f(state.velocity - TANK_GRAVITY * dt);
  velocity = Math.max(-TANK_MAX_FALL_SPEED, velocity);
  let next = f(y + velocity * dt);
  if (next <= ground) {
    position.y = ground;
    return verticalResult(updatedVerticalState(0, false, workspace), true, workspace);
  }
  position.y = next;
  return verticalResult(updatedVerticalState(velocity, true, workspace), true, workspace);
}

function updatedVerticalState(velocity: number, airborne: boolean,
  workspace?: TankVerticalWorkspace): TankVerticalState {
  if (!workspace) return {velocity, airborne};
  workspace.updatedState.velocity = velocity;
  workspace.updatedState.airborne = airborne;
  return workspace.updatedState;
}

function verticalResult(state: TankVerticalState, accepted: boolean,
  workspace?: TankVerticalWorkspace): TankVerticalStep {
  if (!workspace) return {state, accepted};
  workspace.result.state = state;
  workspace.result.accepted = accepted;
  return workspace.result;
}
