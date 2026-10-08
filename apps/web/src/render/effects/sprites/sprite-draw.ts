import type {Camera} from '@babylonjs/core';
import {effectCameraCorners, effectCameraUv} from '../camera/effect-camera';
import {applyEffectTrailAlpha, packEffectColor} from '../common/effect-color';
import {transformEffectPosition} from '../common/effect-native-space';
import type {EffectNativeMatrix} from '../common/effect-native-space';
import {effectOrientedCorners} from '../common/effect-render-transform';
import type {EffectQuadData} from '../common/effect-sprite-mesh';
import type {EffectVec3} from '../common/types';
import type {EffectSpriteNodeState} from './effect-sprite-node';

/** Type1 reverse history submission with current color and indexed trail alpha. */
export function effectSpriteDraw(sprite: EffectSpriteNodeState, billboard: boolean,
  uvFrames: readonly [number, number, number, number][], camera: Camera,
  parent?: EffectNativeMatrix): EffectQuadData[] {
  return [...sprite.history.entries].reverse().map((state, reverseIndex) => {
    const index = sprite.history.entries.length - 1 - reverseIndex;
    const center = state.position.map((value, axis) => Math.fround(value + state.orbitOffset[axis])) as EffectVec3;
    const uv = uvFrames[state.frame];
    return {corners: billboard ? effectCameraCorners(camera,
      parent ? transformEffectPosition(parent, center) : center, state.scale, state.angles[2]) :
      effectOrientedCorners(state.position, state.orbitOffset, state.angles, state.scale, parent),
    uv: billboard ? effectCameraUv(uv) : uv,
    packedColor: applyEffectTrailAlpha(packEffectColor(sprite.history.entries[0].color), index, sprite.history.entries.length)};
  });
}
