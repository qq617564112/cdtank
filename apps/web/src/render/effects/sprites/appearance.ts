import type {EffectColor, EffectVec3} from '../common/types';
import {spriteDelta} from '../common/delta';

export interface EffectSpriteAppearance {
  scale: EffectVec3;
  angles: EffectVec3;
  color: EffectColor;
}

export interface EffectSpriteAppearanceConfig extends EffectSpriteAppearance {
  scaleRate: EffectVec3;
  angleRate: EffectVec3;
  colorSubtractRate: EffectColor;
}

export function initialSpriteAppearance(
  config: EffectSpriteAppearanceConfig,
): EffectSpriteAppearance {
  const result: EffectSpriteAppearance = {scale: [0, 0, 0], angles: [0, 0, 0], color: [0, 0, 0, 0]};
  initialSpriteAppearanceToRef(config, result);
  return result;
}

export function initialSpriteAppearanceToRef(config: EffectSpriteAppearanceConfig,
  result: EffectSpriteAppearance): void {
  for (let axis = 0; axis < 3; axis++) {
    result.scale[axis] = Math.fround(config.scale[axis]);
    result.angles[axis] = Math.fround(config.angles[axis]);
  }
  for (let channel = 0; channel < 4; channel++) result.color[channel] = Math.fround(config.color[channel]);
}

export function advanceSpriteAppearance(
  state: EffectSpriteAppearance,
  config: EffectSpriteAppearanceConfig,
  deltaSeconds: number,
): EffectSpriteAppearance {
  const result: EffectSpriteAppearance = {scale: [0, 0, 0], angles: [0, 0, 0], color: [0, 0, 0, 0]};
  advanceSpriteAppearanceToRef(state, config, deltaSeconds, result);
  return result;
}

export function advanceSpriteAppearanceToRef(state: EffectSpriteAppearance,
  config: EffectSpriteAppearanceConfig, deltaSeconds: number, result: EffectSpriteAppearance): void {
  const delta = spriteDelta(deltaSeconds);
  // 0x422d4d stores scaled vec3 components before the caller adds them.
  for (let i = 0; i < 3; i++) {
    result.scale[i] = Math.fround(Math.fround(state.scale[i]) + Math.fround(Math.fround(config.scaleRate[i]) * delta));
    result.angles[i] = Math.fround(Math.fround(state.angles[i]) + Math.fround(Math.fround(config.angleRate[i]) * delta));
  }
  for (let i = 0; i < 4; i++) {
    // Color subtracts the unrounded product, stores f32, then clamps (0x464d7d).
    result.color[i] = Math.max(0, Math.min(1,
      Math.fround(Math.fround(state.color[i]) - Math.fround(config.colorSubtractRate[i]) * delta)));
  }
}

