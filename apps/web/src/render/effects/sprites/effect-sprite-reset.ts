import {EffectSpriteAppearance, EffectSpriteAppearanceConfig, initialSpriteAppearance} from './appearance';
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
  const position = config.baseFlag !== 0 ? state.position : resolvedPosition;
  const appearance = config.baseFlag !== 0 ? state : initialSpriteAppearance(config.appearance);
  return {
    position: position.map(Math.fround) as EffectVec3,
    velocity: (config.baseFlag !== 0 ? state.velocity : config.velocity).map(Math.fround) as EffectVec3,
    orbitOffset: orbitOffset.map(Math.fround) as EffectVec3,
    scale: [...appearance.scale],
    angles: [...appearance.angles],
    color: [...appearance.color],
    frame: state.frame,
  };
}
