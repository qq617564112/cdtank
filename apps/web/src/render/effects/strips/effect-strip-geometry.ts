import {advanceEffectStripUv} from './effect-strip-uv';
import {EffectColor, EffectVec3} from '../common/types';
export interface EffectStripGeometryConfig {
  readonly extent: number;
  readonly outerHeight: number;
  readonly segments: number;
  readonly alternatingWidth: readonly [number, number];
  readonly radii: readonly [number, number];
  readonly radiusRates: readonly [number, number];
  readonly heightRates: readonly [number, number];
  readonly textureLength: number;
}
type EffectStripCorners = readonly [Readonly<EffectVec3>, Readonly<EffectVec3>, Readonly<EffectVec3>, Readonly<EffectVec3>];
export interface EffectStripSegment {
  readonly corners: EffectStripCorners;
  uv: [number, number, number, number];
  color: number;
}

const geometryCorners = new WeakMap<EffectStripGeometryConfig, readonly EffectStripCorners[]>();

/** Published geometry is immutable; UVs and appearance belong to each instance. */
function cornersForGeometry(config: EffectStripGeometryConfig): readonly EffectStripCorners[] {
  const cached = geometryCorners.get(config);
  if (cached) return cached;
  const f = Math.fround;
  const step = f(config.extent / config.segments);
  let angle = 0, outerHeight = f(config.outerHeight), innerHeight = 0;
  let outerRadius = f(config.radii[0]), innerRadius = f(config.radii[1]);
  let outer: EffectVec3 = [0, outerHeight, outerRadius];
  let inner: EffectVec3 = [0, 0, innerRadius];
  const result: EffectStripCorners[] = [];
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
    result.push([inner, nextInner, nextOuter, outer]);
    inner = nextInner;
    outer = nextOuter;
  }
  geometryCorners.set(config, result);
  return result;
}

/** Original type7 0x474f60 strip construction in local space. */
export function initialEffectStripGeometry(config: EffectStripGeometryConfig,
  frame: readonly [number, number, number, number], color: EffectColor): EffectStripSegment[] {
  const corners = cornersForGeometry(config);
  const bytes = color.map(value => Math.trunc(value * 255) & 255);
  const packed = ((bytes[3] << 24) | (bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) >>> 0;
  const result: EffectStripSegment[] = [];
  for (const segment of corners) result.push({corners: segment, uv: [0, 0, 0, 0], color: packed});
  advanceEffectStripUv(0, 0, 0, frame, config.segments, config.textureLength, result);
  return result;
}
