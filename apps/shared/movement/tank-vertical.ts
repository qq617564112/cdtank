import type {NavigationGrid} from './navigation';

/**
 * Vertical motion is an explicit project rule. The original movement
 * entrypoints at 0x433190 and 0x433073 only dispatch horizontal movement and
 * rebuild the horizontal OBB matrix; they do not contain a Y integrator.
 */
export interface TankVerticalState {
  /** Vertical velocity in source units per second. */
  velocity: number;
  /** True while the body is not resting on the sampled NAV surface. */
  airborne: boolean;
}

export interface TankVerticalStep {
  state: TankVerticalState;
  /** False when a horizontal candidate needs more than the adopted step height. */
  accepted: boolean;
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
 */
export function advanceTankVertical(position: {x: number; y: number; z: number},
  navigation: NavigationGrid | undefined, state: TankVerticalState, dt: number,
  horizontalRise = 0): TankVerticalStep {
  if (!navigation) return {state, accepted: true};
  const cell = navigation.sample(position.x, position.z);
  if (!cell?.valid) return {state, accepted: true};
  const ground = f(cell.height);
  const y = f(position.y);
  if (!(dt > 0)) {
    if (y < ground - TANK_GROUND_SNAP) {
      position.y = ground;
      return {state: {velocity: 0, airborne: false}, accepted: true};
    }
    return {state, accepted: true};
  }
  const rise = Math.max(0, horizontalRise);
  // A grounded body cannot climb a NAV surface step taller than the adopted
  // limit; the horizontal candidate is refused so X/Z stay on the old cell.
  if (!state.airborne && state.velocity <= 0 && rise > TANK_MAX_STEP_HEIGHT) {
    return {state, accepted: false};
  }
  if (y <= ground + TANK_GROUND_SNAP && state.velocity <= 0) {
    position.y = ground;
    return {state: {velocity: 0, airborne: false}, accepted: true};
  }
  let velocity = f(state.velocity - TANK_GRAVITY * dt);
  velocity = Math.max(-TANK_MAX_FALL_SPEED, velocity);
  let next = f(y + velocity * dt);
  if (next <= ground) {
    position.y = ground;
    return {state: {velocity: 0, airborne: false}, accepted: true};
  }
  position.y = next;
  return {state: {velocity, airborne: true}, accepted: true};
}
