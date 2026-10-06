import {effectOrbitOffset} from '../common/orbit';
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
  const addRate = (value: number, rate: number): number => Math.fround(value + Math.fround(rate * delta));
  // The original computes global RotateIn into a temporary but integrates local acceleration.
  const velocity = state.velocity.map((value, axis) => addRate(value, control.motion.acceleration[axis])) as EffectVec3;
  const position = state.position.map((value, axis) => addRate(value, velocity[axis])) as EffectVec3;
  const orbitOffset = control.orbit.angularRate !== 0 ?
    effectOrbitOffset(control.orbit, elapsed, control.baseStart) : [...state.orbitOffset] as EffectVec3;
  const angles = state.angles.map((value, axis) => addRate(value, control.angleRate[axis])) as EffectVec3;
  const scale = state.scale.map((value, axis) => Math.max(0,
    Math.fround(value + delta * control.scaleRate[axis] * control.scale[axis]))) as EffectVec3;
  const color = state.color.map((value, axis) => Math.fround(value + delta * control.colorAddRate[axis])) as EffectColor;
  // Native clamps alpha four times; RGB components retain their computed values.
  color[3] = Math.max(0, Math.min(1, color[3]));
  const frame = advanceEffectFrame({frame: state.frame, remainder: state.frameRemainder}, control, delta, randomFrame);
  return {position, velocity, orbitOffset, angles, scale, color, frame: frame.frame, frameRemainder: frame.remainder};
}
