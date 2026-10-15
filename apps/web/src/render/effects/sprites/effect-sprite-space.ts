import {effectOrbitOffsetToRef} from '../common/orbit';
import {EffectNativeMatrix, rotateEffectVectorToRef} from '../common/effect-native-space';
import {EffectSpriteState} from './effect-sprite-reset';
import {EffectVec3} from '../common/types';
import {integrateSpriteMotionToRef} from '../common/motion';

export interface EffectSpriteSpaceControl {
  baseStart: number;
  motion: {acceleration: EffectVec3};
  orbit: {axis: EffectVec3; radius: number; angularRate: number};
}

/** Type1 0x482eba–0x482fbb; model-aligned velocity is resolved by the caller. */
export function advanceEffectSpriteSpace(state: Pick<EffectSpriteState, 'position' | 'velocity' | 'orbitOffset'>,
  control: EffectSpriteSpaceControl, elapsed: number, deltaSeconds: number,
  globalRotation: EffectNativeMatrix, hasParent: boolean, modelAligned: boolean):
  Pick<EffectSpriteState, 'position' | 'velocity' | 'orbitOffset'> {
  const result: Pick<EffectSpriteState, 'position' | 'velocity' | 'orbitOffset'> =
    {position: [0, 0, 0], velocity: [0, 0, 0], orbitOffset: [0, 0, 0]};
  advanceEffectSpriteSpaceToRef(state, control, elapsed, deltaSeconds,
    globalRotation, hasParent, modelAligned, result, [0, 0, 0]);
  return result;
}

export function advanceEffectSpriteSpaceToRef(state: Pick<EffectSpriteState, 'position' | 'velocity' | 'orbitOffset'>,
  control: EffectSpriteSpaceControl, elapsed: number, deltaSeconds: number,
  globalRotation: EffectNativeMatrix, hasParent: boolean, modelAligned: boolean,
  result: Pick<EffectSpriteState, 'position' | 'velocity' | 'orbitOffset'>, acceleration: EffectVec3): void {
  if (!hasParent) rotateEffectVectorToRef(globalRotation, control.motion.acceleration, acceleration);
  integrateSpriteMotionToRef(state, hasParent ? control.motion.acceleration : acceleration, deltaSeconds, result);
  if (!modelAligned && control.orbit.angularRate !== 0) {
    effectOrbitOffsetToRef(control.orbit, elapsed, control.baseStart, result.orbitOffset);
  } else {
    for (let axis = 0; axis < 3; axis++) result.orbitOffset[axis] = state.orbitOffset[axis];
  }
}
