import {advanceEffectStripUv} from './effect-strip-uv';
import {EffectColor, EffectVec3} from '../common/types';
export interface EffectStripGeometryConfig {
  extent: number;
  outerHeight: number;
  segments: number;
  alternatingWidth: [number, number];
  radii: [number, number];
  radiusRates: [number, number];
  heightRates: [number, number];
  textureLength: number;
}
export interface EffectStripSegment {
  corners: [EffectVec3, EffectVec3, EffectVec3, EffectVec3];
  uv: [number, number, number, number];
  color: number;
}

/** Original type7 0x474f60 strip construction in local space. */
export function initialEffectStripGeometry(config: EffectStripGeometryConfig,
  frame: readonly [number, number, number, number], color: EffectColor): EffectStripSegment[] {
  const f = Math.fround;
  const step = f(config.extent / config.segments);
  let angle = 0, outerHeight = f(config.outerHeight), innerHeight = 0;
  let outerRadius = f(config.radii[0]), innerRadius = f(config.radii[1]);
  let outer: EffectVec3 = [0, outerHeight, outerRadius];
  let inner: EffectVec3 = [0, 0, innerRadius];
  const bytes = color.map(value => Math.trunc(value * 255) & 255);
  const packed = ((bytes[3] << 24) | (bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) >>> 0;
  const uvs = advanceEffectStripUv(0, 0, 0, frame, config.segments, config.textureLength).uvs;
  const result: EffectStripSegment[] = [];
  for (let index = 0; index < config.segments; ++index) {
    angle = f(angle + step);
    outerRadius = f(outerRadius + step * config.radiusRates[0]);
    innerRadius = f(innerRadius + step * config.radiusRates[1]);
    outerHeight = f(outerHeight + step * config.heightRates[0]);
    innerHeight = f(innerHeight + step * config.heightRates[1]);
    const radians = angle * Math.fround(.01745329238474369);
    const sine = f(Math.sin(radians)), cosine = Math.cos(f(radians));
    const outerAt = index % 2 === 0 ? outerRadius - config.alternatingWidth[0] : outerRadius;
    const innerAt = index % 2 === 0 ? innerRadius - config.alternatingWidth[1] : innerRadius;
    const nextOuter: EffectVec3 = [f(sine * outerAt), outerHeight, f(cosine * outerAt)];
    const nextInner: EffectVec3 = [f(sine * innerAt), innerHeight, f(cosine * innerAt)];
    result.push({corners: [inner, nextInner, nextOuter, outer], uv: uvs[index], color: packed});
    inner = nextInner;
    outer = nextOuter;
  }
  return result;
}
