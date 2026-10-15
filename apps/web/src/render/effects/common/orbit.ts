import {normalizeEffectVectorToRef} from './effect-native-space';
import type {EffectVec3} from './types';

export interface EffectOrbit {axis: EffectVec3; radius: number; angularRate: number;}

/** Original axis-normalized orbit quaternion, rotated local +Z radius. */
export function effectOrbitOffset(orbit: EffectOrbit,
  elapsed: number, baseStart: number): EffectVec3 {
  const result: EffectVec3 = [0, 0, 0];
  effectOrbitOffsetToRef(orbit, elapsed, baseStart, result);
  return result;
}

export function effectOrbitOffsetToRef(orbit: EffectOrbit,
  elapsed: number, baseStart: number, result: EffectVec3): void {
  normalizeEffectVectorToRef(orbit.axis, result);
  const angle = Math.fround((Math.fround(elapsed) - Math.fround(baseStart)) *
    Math.fround(orbit.angularRate));
  const halfAngle = angle * Math.fround(.01745329238474369) * .5;
  const sine = Math.sin(Math.fround(halfAngle));
  const x = Math.fround(sine * result[0]), y = Math.fround(sine * result[1]), z = Math.fround(sine * result[2]);
  const w = Math.fround(Math.cos(halfAngle));
  const xx = 2 * x * x;
  const yy = Math.fround(2 * y * y);
  const xz = Math.fround(2 * x * z), yw = Math.fround(2 * y * w);
  const yz = Math.fround(2 * y * z), xw = Math.fround(2 * x * w);
  const radius = Math.fround(orbit.radius);
  result[0] = Math.fround(Math.fround(yw + xz) * radius);
  result[1] = Math.fround(Math.fround(yz - xw) * radius);
  result[2] = Math.fround(Math.fround(1 - xx - yy) * radius);
}
