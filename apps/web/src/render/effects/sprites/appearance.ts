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
  return {
    scale: config.scale.map(Math.fround) as EffectVec3,
    angles: config.angles.map(Math.fround) as EffectVec3,
    color: config.color.map(Math.fround) as EffectColor,
  };
}

export function advanceSpriteAppearance(
  state: EffectSpriteAppearance,
  config: EffectSpriteAppearanceConfig,
  deltaSeconds: number,
): EffectSpriteAppearance {
  const delta = spriteDelta(deltaSeconds);
  // 0x422d4d stores scaled vec3 components before the caller adds them.
  const addScaled = (value: number, rate: number): number =>
    Math.fround(Math.fround(value) + Math.fround(Math.fround(rate) * delta));
  return {
    scale: state.scale.map((v, i) => addScaled(v, config.scaleRate[i])) as EffectVec3,
    angles: state.angles.map((v, i) => addScaled(v, config.angleRate[i])) as EffectVec3,
    // Color subtracts the unrounded product, stores f32, then clamps (0x464d7d).
    color: state.color.map((v, i) => Math.max(0, Math.min(1,
      Math.fround(Math.fround(v) - Math.fround(config.colorSubtractRate[i]) * delta),
    ))) as EffectColor,
  };
}

