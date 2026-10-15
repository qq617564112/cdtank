import type {EffectQuadData} from './effect-sprite-mesh';
import {EffectRenderTransform} from './effect-render-transform';
import type {EffectVec3} from './types';

interface BufferedQuad extends EffectQuadData {
  uv: [number, number, number, number];
}

/** Instance-owned scratch data, consumed synchronously by EffectSpriteMesh. */
export class EffectQuadBuffer {
  readonly quads: BufferedQuad[] = [];
  readonly center: EffectVec3 = [0, 0, 0];
  readonly scale: EffectVec3 = [1, 1, 1];
  transform?: EffectRenderTransform;
  private readonly capacity: BufferedQuad[] = [];

  resize(count: number): BufferedQuad[] {
    for (let index = this.quads.length; index < count; index++) {
      this.quads[index] = this.capacity[index] ??= {
        corners: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
        uv: [0, 0, 0, 0], packedColor: 0,
      };
    }
    this.quads.length = count;
    return this.quads;
  }
}
