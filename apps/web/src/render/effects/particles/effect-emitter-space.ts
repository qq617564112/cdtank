import {EffectNativeMatrix, rotateEffectVectorToRef, transformEffectPositionInPlaceToRef} from '../common/effect-native-space';
import type {EffectVec3} from '../common/types';
import {EffectPathClock} from '../common/effect-path-clock';
import {EffectOrbit, effectOrbitOffsetToRef} from '../common/orbit';

export interface EffectEmitterSpace {
  position: EffectVec3;
  orbitOffset: EffectVec3;
}
export interface EffectEmitterSpaceControl {
  baseStart: number;
  motion: {position: EffectVec3; velocity: EffectVec3};
  orbit: EffectOrbit;
}

const resetRotation: EffectNativeMatrix = new Array<number>(16).fill(0);

/** Original type6 0x4801d4 non-path emitter integration and orbital displacement. */
export function advanceEffectEmitterSpace(state: EffectEmitterSpace,
  control: EffectEmitterSpaceControl, elapsed: number, deltaSeconds: number,
  globalRotation: EffectNativeMatrix, hasParent: boolean,
  path?: {clock: EffectPathClock; origin: EffectVec3}): EffectEmitterSpace {
  const result: EffectEmitterSpace = {position: [0, 0, 0], orbitOffset: [0, 0, 0]};
  advanceEffectEmitterSpaceToRef(state, control, elapsed, deltaSeconds,
    globalRotation, hasParent, result, [0, 0, 0], path);
  return result;
}

export function advanceEffectEmitterSpaceToRef(state: EffectEmitterSpace,
  control: EffectEmitterSpaceControl, elapsed: number, deltaSeconds: number,
  globalRotation: EffectNativeMatrix, hasParent: boolean, result: EffectEmitterSpace,
  velocity: EffectVec3, path?: {clock: EffectPathClock; origin: EffectVec3}): void {
  const delta = Math.fround(deltaSeconds);
  if (hasParent) {
    for (let axis = 0; axis < 3; axis++) velocity[axis] = Math.fround(control.motion.velocity[axis]);
  } else {
    rotateEffectVectorToRef(globalRotation, control.motion.velocity, velocity);
  }
  for (let axis = 0; axis < 3; axis++) {
    result.position[axis] = Math.fround(Math.fround(state.position[axis]) +
      (axis === 2 ? Math.fround(velocity[axis] * delta) : velocity[axis] * delta));
  }
  if (control.orbit.angularRate !== 0) {
    effectOrbitOffsetToRef(control.orbit, elapsed, control.baseStart, result.orbitOffset);
  } else {
    for (let axis = 0; axis < 3; axis++) result.orbitOffset[axis] = state.orbitOffset[axis];
  }
  if (path) {
    path.clock.advanceToRef(delta, result.position);
    for (let axis = 0; axis < 3; axis++) {
      result.position[axis] = Math.fround(result.position[axis] + Math.fround(path.origin[axis]));
      result.orbitOffset[axis] = 0;
    }
  }
}


/** Original type6 world start space initialization, without path resolution. */
export function startEffectEmitterSpace(control: EffectEmitterSpaceControl, origin: EffectVec3,
  globalRotation: EffectNativeMatrix, hasParent: boolean,
  previousOrbitOffset: EffectVec3): EffectEmitterSpace {
  const result: EffectEmitterSpace = {position: [0, 0, 0], orbitOffset: [0, 0, 0]};
  startEffectEmitterSpaceToRef(control, origin, globalRotation, hasParent,
    previousOrbitOffset, result, [0, 0, 0]);
  return result;
}

/** Reuse node-owned output; previousOrbitOffset may be result.orbitOffset. */
export function startEffectEmitterSpaceToRef(control: EffectEmitterSpaceControl, origin: EffectVec3,
  globalRotation: EffectNativeMatrix, hasParent: boolean,
  previousOrbitOffset: EffectVec3, result: EffectEmitterSpace, velocity: EffectVec3): void {
  if (hasParent) {
    for (let axis = 0; axis < 3; axis++) result.position[axis] = Math.fround(control.motion.position[axis]);
  } else {
    transformEffectPositionInPlaceToRef(globalRotation, control.motion.position, result.position);
  }
  for (let axis = 0; axis < 3; axis++) result.orbitOffset[axis] = previousOrbitOffset[axis];
  advanceEffectEmitterSpaceToRef(result, control, control.baseStart, 0,
    globalRotation, hasParent, result, velocity);
  for (let axis = 0; axis < 3; axis++) {
    result.position[axis] = Math.fround(result.position[axis] + Math.fround(origin[axis]));
  }
}

/** Controller reset retains preceding position and initializes only active orbit. */
export function resetEffectEmitterSpace(previous: EffectEmitterSpace,
  nextOrbitOffset: EffectVec3, control: EffectEmitterSpaceControl): EffectEmitterSpace {
  const result: EffectEmitterSpace = {position: [0, 0, 0], orbitOffset: [0, 0, 0]};
  resetEffectEmitterSpaceToRef(previous, nextOrbitOffset, control, result, [0, 0, 0]);
  return result;
}

/** Copy the preceding position; nextOrbitOffset may be result.orbitOffset. */
export function resetEffectEmitterSpaceToRef(previous: EffectEmitterSpace,
  nextOrbitOffset: EffectVec3, control: EffectEmitterSpaceControl,
  result: EffectEmitterSpace, velocity: EffectVec3): void {
  for (let axis = 0; axis < 3; axis++) {
    result.position[axis] = previous.position[axis];
    result.orbitOffset[axis] = nextOrbitOffset[axis];
  }
  advanceEffectEmitterSpaceToRef(result, control, control.baseStart, 0,
    resetRotation, true, result, velocity);
}

