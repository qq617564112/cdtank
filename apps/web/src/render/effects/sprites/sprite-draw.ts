import type {Camera} from '@babylonjs/core';
import {effectCameraCornersToRef} from '../camera/effect-camera';
import {applyEffectTrailAlpha, packEffectColor} from '../common/effect-color';
import {transformEffectPositionToRef} from '../common/effect-native-space';
import type {EffectNativeMatrix} from '../common/effect-native-space';
import {effectOrientedCornersToRef, EffectRenderTransform} from '../common/effect-render-transform';
import {EffectQuadBuffer} from '../common/effect-quad-buffer';
import type {EffectQuadData} from '../common/effect-sprite-mesh';
import type {EffectSpriteNodeState} from './effect-sprite-node';

/** Type1 reverse history submission with current color and indexed trail alpha. */
export function effectSpriteDraw(sprite: EffectSpriteNodeState, billboard: boolean | 'y',
  uvFrames: readonly [number, number, number, number][], camera: Camera,
  parent?: EffectNativeMatrix, displayScale = 1, buffer = new EffectQuadBuffer()): EffectQuadData[] {
  // Missing action tags use a zero matrix and have no world-space artwork.
  if (parent?.every(value => value === 0)) return buffer.resize(0);
  const entries = sprite.history.entries;
  const quads = buffer.resize(entries.length);
  const color = packEffectColor(entries[0].color);
  for (let index = entries.length - 1; index >= 0; index--) {
    const state = entries[index];
    const quad = quads[entries.length - 1 - index];
    const uv = uvFrames[state.frame];
    const scale = displayScale === 1 ? state.scale : buffer.scale;
    if (displayScale !== 1) {
      for (let axis = 0; axis < 3; axis++) scale[axis] = Math.fround(state.scale[axis] * displayScale);
    }
    if (billboard) {
      const center = buffer.center;
      for (let axis = 0; axis < 3; axis++) center[axis] = Math.fround(state.position[axis] + state.orbitOffset[axis]);
      if (parent) transformEffectPositionToRef(parent, center, center);
      effectCameraCornersToRef(camera, center, scale, state.angles[2], quad.corners, billboard === 'y');
    } else {
      effectOrientedCornersToRef(state.position, state.orbitOffset, state.angles, scale, quad.corners,
        buffer.transform ??= new EffectRenderTransform(), parent);
    }
    // Camera-facing quads retain the established reflected U coordinates.
    quad.uv[0] = uv[billboard ? 2 : 0]; quad.uv[1] = uv[1];
    quad.uv[2] = uv[billboard ? 0 : 2]; quad.uv[3] = uv[3];
    quad.packedColor = applyEffectTrailAlpha(color, index, entries.length);
  }
  return quads;
}
