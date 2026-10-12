/** CDTank.exe 464e83: position blend called by original 4654f1. */
export interface RoleSpatialPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function roleSpatialBlendWeight(elapsed: number, period = Math.fround(0.1)): number {
  return Math.min(1, Math.max(0,
    Math.fround(Math.fround(elapsed) / Math.fround(period) + Math.fround(0.05))));
}

export function blendRoleSpatialPosition(
    current: RoleSpatialPoint, target: RoleSpatialPoint,
    elapsed: number, period = Math.fround(0.1)): RoleSpatialPoint {
  const weight = roleSpatialBlendWeight(elapsed, period);
  const inverse = Math.fround(1 - weight);
  const blend = (from: number, to: number): number => Math.fround(
    Math.fround(Math.fround(to) * weight) + Math.fround(Math.fround(from) * inverse));
  return {x: blend(current.x, target.x), y: blend(current.y, target.y),
    z: blend(current.z, target.z)};
}

export interface RoleSpatialState {
  readonly position: RoleSpatialPoint;
  readonly target: RoleSpatialPoint;
  readonly elapsed: number;
  readonly period: number;
  readonly stopped: boolean;
  readonly targetPresent: boolean;
  readonly direction: 1 | -1;
}

function floatPoint(point: RoleSpatialPoint): RoleSpatialPoint {
  return {x: Math.fround(point.x), y: Math.fround(point.y), z: Math.fround(point.z)};
}

/** Original 466efb position fields; curve last point equals the supplied target. */
export function setRoleSpatialPose(state: RoleSpatialState, target: RoleSpatialPoint,
    currentLook: RoleSpatialPoint, blocked: boolean): RoleSpatialState {
  if (blocked) return state;
  const point = floatPoint(target);
  const dx = Math.fround(point.x - Math.fround(state.position.x));
  const dy = Math.fround(point.y - Math.fround(state.position.y));
  const dz = Math.fround(point.z - Math.fround(state.position.z));
  const dot = dy * Math.fround(currentLook.y) + dz * Math.fround(currentLook.z) +
    dx * Math.fround(currentLook.x);
  return {...state, target: point, elapsed: 0, stopped: false,
    targetPresent: true, direction: dot < 0 ? -1 : 1};
}

/** Original 46753f float32 accumulation, before its target movement gate. */
export function accumulateRoleSpatialDelta(
    state: RoleSpatialState, deltaSeconds: number): RoleSpatialState {
  return {...state, elapsed: Math.fround(Math.fround(state.elapsed) + Math.fround(deltaSeconds))};
}

/** Original 464e83 position branch; caller has already selected 4654f1. */
export function advanceRoleSpatialPosition(state: RoleSpatialState): RoleSpatialState {
  return {...state, position: blendRoleSpatialPosition(
    state.position, state.target, state.elapsed, state.period)};
}
