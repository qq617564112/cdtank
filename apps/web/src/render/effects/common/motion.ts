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
  const result: EffectSpriteMotion = {position: [0, 0, 0], velocity: [0, 0, 0]};
  integrateSpriteMotionToRef(state, acceleration, deltaSeconds, result);
  return result;
}

export function integrateSpriteMotionToRef(state: EffectSpriteMotion, acceleration: EffectVec3,
  deltaSeconds: number, result: EffectSpriteMotion): void {
  const delta = spriteDelta(deltaSeconds);
  const velocity = result.velocity;
  for (let i = 0; i < 3; i++) {
    const product = Math.fround(acceleration[i]) * delta;
    // The native Z path spills the product to f32; X/Y keep it in x87.
    velocity[i] = Math.fround(Math.fround(state.velocity[i]) + (i === 2 ? Math.fround(product) : product));
  }
  for (let i = 0; i < 3; i++) {
    const product = velocity[i] * delta;
    result.position[i] = Math.fround(Math.fround(state.position[i]) + (i === 2 ? Math.fround(product) : product));
  }
}

