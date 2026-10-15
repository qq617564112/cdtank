import {effectOrbitOffsetToRef} from '../common/orbit';
import {advanceEffectFrame, EffectFrameConfig} from '../common/effect-frame-clock';
import {EffectNativeMatrix} from '../common/effect-native-space';
import {EffectSpriteState} from '../sprites/effect-sprite-reset';
import {EffectColor, EffectVec3} from '../common/types';

export interface EffectStripState extends EffectSpriteState {frameRemainder: number;}
export interface EffectStripControl extends EffectFrameConfig {
  baseStart: number;
  motion: {acceleration: EffectVec3};
  orbit: {axis: EffectVec3; radius: number; angularRate: number};
  scale: EffectVec3;
  scaleRate: EffectVec3;
  angleRate: EffectVec3;
  colorAddRate: EffectColor;
}

/** Type7 state update; path/provider and generated strip UVs remain external. */
export function advanceEffectStripState(state: EffectStripState, control: EffectStripControl,
  elapsed: number, deltaSeconds: number, globalRotation: EffectNativeMatrix, hasParent: boolean,
  randomFrame: (count: number) => number): EffectStripState {
  const delta = Math.fround(deltaSeconds);
  // The original computes global RotateIn into a temporary but integrates local acceleration.
  const {velocity, position, angles, scale, color} = state;
  for (let axis = 0; axis < 3; ++axis) {
    velocity[axis] = Math.fround(velocity[axis] + Math.fround(control.motion.acceleration[axis] * delta));
    position[axis] = Math.fround(position[axis] + Math.fround(velocity[axis] * delta));
  }
  if (control.orbit.angularRate !== 0) {
    effectOrbitOffsetToRef(control.orbit, elapsed, control.baseStart, state.orbitOffset);
  }
  for (let axis = 0; axis < 3; ++axis) {
    angles[axis] = Math.fround(angles[axis] + Math.fround(control.angleRate[axis] * delta));
    scale[axis] = Math.max(0, Math.fround(scale[axis] + delta * control.scaleRate[axis] * control.scale[axis]));
  }
  for (let axis = 0; axis < 4; ++axis) {
    color[axis] = Math.fround(color[axis] + delta * control.colorAddRate[axis]);
  }
  // Native clamps alpha four times; RGB components retain their computed values.
  color[3] = Math.max(0, Math.min(1, color[3]));
  advanceEffectFrame(state, control, delta, randomFrame);
  return state;
}
