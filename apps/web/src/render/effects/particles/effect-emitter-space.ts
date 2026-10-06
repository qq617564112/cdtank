import {EffectNativeMatrix, rotateEffectVector, transformEffectPositionInPlace} from '../common/effect-native-space';
import type {EffectVec3} from '../common/types';
import {EffectPathClock} from '../common/effect-path-clock';
import {EffectOrbit, effectOrbitOffset} from '../common/orbit';

export interface EffectEmitterSpace {
  position: EffectVec3;
  orbitOffset: EffectVec3;
}
export interface EffectEmitterSpaceControl {
  baseStart: number;
  motion: {position: EffectVec3; velocity: EffectVec3};
  orbit: EffectOrbit;
}

/** Original type6 0x4801d4 non-path emitter integration and orbital displacement. */
export function advanceEffectEmitterSpace(state: EffectEmitterSpace,
  control: EffectEmitterSpaceControl, elapsed: number, deltaSeconds: number,
  globalRotation: EffectNativeMatrix, hasParent: boolean,
  path?: {clock: EffectPathClock; origin: EffectVec3}): EffectEmitterSpace {
  const delta = Math.fround(deltaSeconds);
  const velocity = hasParent ? control.motion.velocity.map(Math.fround) :
    rotateEffectVector(globalRotation, control.motion.velocity);
  let position = state.position.map((value, index) => Math.fround(Math.fround(value) +
    (index === 2 ? Math.fround(velocity[index] * delta) : velocity[index] * delta))) as EffectVec3;
  let orbitOffset: EffectVec3 = [...state.orbitOffset];
  if (control.orbit.angularRate !== 0) {
    orbitOffset = effectOrbitOffset(control.orbit, elapsed, control.baseStart);
  }
  if (path) {
    const sampled = path.clock.advance(delta);
    position = sampled.map((value, index) => Math.fround(value + Math.fround(path.origin[index]))) as EffectVec3;
    orbitOffset = [0, 0, 0];
  }
  return {position, orbitOffset};
}


/** Original type6 world start space initialization, without path resolution. */
export function startEffectEmitterSpace(control: EffectEmitterSpaceControl, origin: EffectVec3,
  globalRotation: EffectNativeMatrix, hasParent: boolean,
  previousOrbitOffset: EffectVec3): EffectEmitterSpace {
  const local = hasParent ? control.motion.position.map(Math.fround) :
    transformEffectPositionInPlace(globalRotation, control.motion.position);
  const initialized = advanceEffectEmitterSpace({position: local as EffectVec3,
    orbitOffset: [...previousOrbitOffset]}, control, control.baseStart, 0, globalRotation, hasParent);
  return {position: initialized.position.map((value, index) =>
    Math.fround(value + Math.fround(origin[index]))) as EffectVec3,
    orbitOffset: initialized.orbitOffset};
}

/** Controller reset retains preceding position and initializes only active orbit. */
export function resetEffectEmitterSpace(previous: EffectEmitterSpace,
  nextOrbitOffset: EffectVec3, control: EffectEmitterSpaceControl): EffectEmitterSpace {
  return advanceEffectEmitterSpace({position: [...previous.position], orbitOffset: [...nextOrbitOffset]},
    control, control.baseStart, 0, Array<number>(16).fill(0), true);
}

