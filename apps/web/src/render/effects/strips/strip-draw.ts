import {packEffectColor} from '../common/effect-color';
import {transformEffectPosition} from '../common/effect-native-space';
import type {EffectNativeMatrix} from '../common/effect-native-space';
import {effectRenderMatrix} from '../common/effect-render-transform';
import type {EffectQuadData} from '../common/effect-sprite-mesh';
import type {EffectVec3} from '../common/types';
import type {EffectStripNodeState} from './effect-strip-node';

/** Type7 segment order, source UVs and colors transformed to world quads. */
export function effectStripDraw(strip: EffectStripNodeState, parent?: EffectNativeMatrix): EffectQuadData[] {
  const state = strip.state;
  const matrix = effectRenderMatrix(state.position, state.orbitOffset, state.angles, state.scale, parent);
  return strip.geometry.map(segment => ({
    corners: segment.corners.map(corner => transformEffectPosition(matrix, corner)) as [EffectVec3, EffectVec3, EffectVec3, EffectVec3],
    uv: segment.uv, packedColor: packEffectColor(state.color),
  }));
}
