import {packEffectColor} from '../common/effect-color';
import {EffectColor, EffectVec3} from '../common/types';

export interface EffectOverlayVertex {position: EffectVec3; rhw: number; uv: [number, number]; color: number;}

/** DLL RenderUIQuad 0x10025650, native XYZRHW pixels without a half-pixel shift. */
export function effectOverlayVertices(draw: EffectOverlayRectangle): EffectOverlayVertex[] {
  const [left, bottom, right, top, u0, v0, u1, v1] = draw.rectangle;
  const corners: EffectVec3[] = [[left, bottom, draw.z], [right, bottom, draw.z],
    [left, top, draw.z], [right, top, draw.z]];
  const uvs: [number, number][] = [[u0, v0], [u1, v0], [u0, v1], [u1, v1]];
  return [0, 1, 2, 2, 1, 3].map(index => ({position: corners[index], rhw: 1, uv: uvs[index], color: draw.color}));
}

export interface EffectOverlayRectangle {
  rectangle: readonly [number, number, number, number, number, number, number, number];
  z: number;
  color: number;
}

/** Type8 screen rectangle, UV retention and original diffuse packing. */
export class EffectOverlayDrawState {
  private uv: readonly [number, number, number, number] = [0, 0, 1, 1];

  constructor(private width: number, private height: number) {}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  draw(color: EffectColor, textured: boolean,
    frameUv: readonly [number, number, number, number]): EffectOverlayRectangle {
    if (textured) this.uv = frameUv;
    return {
      rectangle: [0, Math.fround(this.height), Math.fround(this.width), 0, ...this.uv],
      z: 0,
      color: packEffectColor(color),
    };
  }
}
