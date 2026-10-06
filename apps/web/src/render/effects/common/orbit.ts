import {normalizeEffectVector} from './effect-native-space';
import type {EffectVec3} from './types';

export interface EffectOrbit {axis: EffectVec3; radius: number; angularRate: number;}

/** Original axis-normalized orbit quaternion, rotated local +Z radius. */
export function effectOrbitOffset(orbit: EffectOrbit,
  elapsed: number, baseStart: number): EffectVec3 {
    const axis = normalizeEffectVector(orbit.axis);
    const angle = Math.fround((Math.fround(elapsed) - Math.fround(baseStart)) *
      Math.fround(orbit.angularRate));
    const halfAngle = angle * Math.fround(.01745329238474369) * .5;
    const sine = Math.sin(Math.fround(halfAngle));
    const [x, y, z] = axis.map(value => Math.fround(sine * value));
    const w = Math.fround(Math.cos(halfAngle));
    const xx = 2 * x * x;
    const yy = Math.fround(2 * y * y);
    const xz = Math.fround(2 * x * z), yw = Math.fround(2 * y * w);
    const yz = Math.fround(2 * y * z), xw = Math.fround(2 * x * w);
    const radius = Math.fround(orbit.radius);
    return [Math.fround(Math.fround(yw + xz) * radius),
      Math.fround(Math.fround(yz - xw) * radius),
      Math.fround(Math.fround(1 - xx - yy) * radius)];
}
