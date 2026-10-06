import type {EffectVec3} from './types';
import {spriteDelta} from './delta';

export interface EffectSpriteMotion {
  position: EffectVec3;
  velocity: EffectVec3;
}

/**
 * acceleration must already be in the state's native XYZ coordinate space.
 * Model-aligned velocity, global RotateIn, paths and orbit offsets are external
 * operations in the native update and must be applied by the future renderer.
 */
export function integrateSpriteMotion(
  state: EffectSpriteMotion,
  acceleration: EffectVec3,
  deltaSeconds: number,
): EffectSpriteMotion {
  const delta = spriteDelta(deltaSeconds);
  const velocity = state.velocity.map((v, i) => {
    const product = Math.fround(acceleration[i]) * delta;
    // The native Z path spills the product to f32; X/Y keep it in x87.
    return Math.fround(Math.fround(v) + (i === 2 ? Math.fround(product) : product));
  }) as EffectVec3;
  const position = state.position.map((v, i) => {
    const product = velocity[i] * delta;
    return Math.fround(Math.fround(v) + (i === 2 ? Math.fround(product) : product));
  }) as EffectVec3;
  return {position, velocity};
}

