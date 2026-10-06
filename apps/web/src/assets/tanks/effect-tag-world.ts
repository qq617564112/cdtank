import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {EffectVec3} from '../../render/effects/common/types';

export interface EffectTagWorldPose {
  readonly position: EffectVec3;
  readonly yaw: number;
  readonly turretYaw: number;
  readonly pivot: readonly [number, number];
}

/** Original primary tag world composition; angles are native degrees. */
export function composeEffectWorldTag(local: EffectNativeMatrix, pose: EffectTagWorldPose,
  useTurret: boolean): EffectNativeMatrix {
  if (local.every(value => value === 0)) return [...local];
  const degrees = Math.fround(useTurret ? pose.turretYaw : pose.yaw);
  const angle = degrees * Math.fround(.01745329238474369);
  const cosine = Math.fround(Math.cos(angle));
  const sine = Math.fround(Math.sin(Math.fround(angle)));
  const world = [cosine, 0, -sine, 0, 0, 1, 0, 0, sine, 0, cosine, 0,
    useTurret ? Math.fround(pose.pivot[0]) : 0, 0,
    useTurret ? Math.fround(pose.pivot[1]) : 0, 1];
  const transformed = multiplyRows(local.map(Math.fround), world);
  for (let index = 0; index < 3; ++index) {
    transformed[12 + index] = Math.fround(transformed[12 + index] + Math.fround(pose.position[index]));
  }
  // Original +Z / 180 degree quaternion setup retains this nonzero cosine.
  const twiceW = 2 * Math.fround(1.2167964413833943e-8);
  const correction = [-1, twiceW, 0, 0, -twiceW, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return multiplyRows(correction, transformed);
}

function multiplyRows(first: readonly number[], second: readonly number[]): number[] {
  const result: number[] = [];
  for (let row = 0; row < 4; ++row) {
    for (let column = 0; column < 4; ++column) {
      result.push(Math.fround(((first[row * 4] * second[column] +
        first[row * 4 + 1] * second[4 + column]) +
        first[row * 4 + 2] * second[8 + column]) +
        first[row * 4 + 3] * second[12 + column]));
    }
  }
  return result;
}
