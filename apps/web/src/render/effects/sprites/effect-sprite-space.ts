import {effectOrbitOffset} from '../common/orbit';
import {EffectNativeMatrix, rotateEffectVector} from '../common/effect-native-space';
import {EffectSpriteState} from './effect-sprite-reset';
import {EffectVec3} from '../common/types';
import {integrateSpriteMotion} from '../common/motion';

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
  const acceleration = hasParent ? control.motion.acceleration :
    rotateEffectVector(globalRotation, control.motion.acceleration);
  const motion = integrateSpriteMotion(state, acceleration, deltaSeconds);
  const orbitOffset = !modelAligned && control.orbit.angularRate !== 0 ?
    effectOrbitOffset(control.orbit, elapsed, control.baseStart) : [...state.orbitOffset] as EffectVec3;
  return {...motion, orbitOffset};
}
