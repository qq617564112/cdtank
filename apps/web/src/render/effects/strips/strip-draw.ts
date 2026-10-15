import {packEffectColor} from '../common/effect-color';
import {transformEffectPositionToRef} from '../common/effect-native-space';
import type {EffectNativeMatrix} from '../common/effect-native-space';
import {EffectRenderTransform} from '../common/effect-render-transform';
import {EffectQuadBuffer} from '../common/effect-quad-buffer';
import type {EffectQuadData} from '../common/effect-sprite-mesh';
import type {EffectStripNodeState} from './effect-strip-node';

/** Type7 segment order, source UVs and colors transformed to world quads. */
export function effectStripDraw(strip: EffectStripNodeState, parent?: EffectNativeMatrix,
  buffer = new EffectQuadBuffer()): EffectQuadData[] {
  const state = strip.state;
  const matrix = (buffer.transform ??= new EffectRenderTransform())
    .update(state.position, state.orbitOffset, state.angles, state.scale, parent);
  const quads = buffer.resize(strip.geometry.length);
  const color = packEffectColor(state.color);
  for (let index = 0; index < strip.geometry.length; index++) {
    const segment = strip.geometry[index], quad = quads[index];
    for (let corner = 0; corner < 4; corner++) {
      transformEffectPositionToRef(matrix, segment.corners[corner], quad.corners[corner]);
      quad.uv[corner] = segment.uv[corner];
    }
    quad.packedColor = color;
  }
  return quads;
}
