import {EffectSpriteAppearance, EffectSpriteAppearanceConfig, initialSpriteAppearanceToRef} from './appearance';
import {EffectSpriteMotion} from '../common/motion';
import {EffectVec3} from '../common/types';

/** All fields of the native 80-byte type-1 instance state. */
export interface EffectSpriteState extends EffectSpriteAppearance, EffectSpriteMotion {
  orbitOffset: EffectVec3;
  frame: number;
}

export interface EffectSpriteResetConfig {
  baseFlag: number;
  appearance: EffectSpriteAppearanceConfig;
  velocity: EffectVec3;
}

/** Spatial inputs must already include native model/path/orbit resolution. */
export function resetEffectSprite(state: EffectSpriteState, config: EffectSpriteResetConfig,
  resolvedPosition: EffectVec3, orbitOffset: EffectVec3): EffectSpriteState {
  const result: EffectSpriteState = {position: [0, 0, 0], velocity: [0, 0, 0], orbitOffset: [0, 0, 0],
    scale: [0, 0, 0], angles: [0, 0, 0], color: [0, 0, 0, 0], frame: 0};
  resetEffectSpriteToRef(state, config, resolvedPosition, orbitOffset, result);
  return result;
}

/** Entry zero may be updated in place; older trail entries remain independent. */
export function resetEffectSpriteToRef(state: EffectSpriteState, config: EffectSpriteResetConfig,
  resolvedPosition: EffectVec3, orbitOffset: EffectVec3, result: EffectSpriteState): void {
  const retain = config.baseFlag !== 0;
  const position = retain ? state.position : resolvedPosition;
  const velocity = retain ? state.velocity : config.velocity;
  for (let axis = 0; axis < 3; axis++) {
    result.position[axis] = Math.fround(position[axis]);
    result.velocity[axis] = Math.fround(velocity[axis]);
    result.orbitOffset[axis] = Math.fround(orbitOffset[axis]);
  }
  if (retain) {
    for (let axis = 0; axis < 3; axis++) {
      result.scale[axis] = state.scale[axis];
      result.angles[axis] = state.angles[axis];
    }
    for (let channel = 0; channel < 4; channel++) result.color[channel] = state.color[channel];
  } else {
    initialSpriteAppearanceToRef(config.appearance, result);
  }
  result.frame = state.frame;
}
