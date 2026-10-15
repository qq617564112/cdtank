import type {EffectVec3} from '../common/types';

export function effectBillboardCorners(center: EffectVec3, halfSize: EffectVec3,
  angleDegrees: number): [EffectVec3, EffectVec3, EffectVec3, EffectVec3] {
  const result: [EffectVec3, EffectVec3, EffectVec3, EffectVec3] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  effectBillboardCornersToRef(center, halfSize, angleDegrees, result);
  return result;
}

/** Original billboard branch 0x481b62–0x481c38, in native camera space. */
export function effectBillboardCornersToRef(center: EffectVec3, halfSize: EffectVec3,
  angleDegrees: number, result: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3]): void {
  const x = Math.fround(center[0]), y = Math.fround(center[1]), z = Math.fround(center[2]);
  const width = Math.fround(halfSize[0]), height = Math.fround(halfSize[1]);
  // The native conversion constant is f32, not JavaScript Math.PI / 180.
  const radians = Math.fround(angleDegrees) * Math.fround(0.01745329238474369);
  const cosine = Math.fround(Math.cos(radians));
  const sine = Math.sin(radians);
  const negativeWidthCosine = Math.fround(-width * cosine);
  const negativeHeightSine = Math.fround(-height * sine);
  const negativeWidthSine = Math.fround(-width * sine);
  const positiveWidthCosine = Math.fround(width * cosine);
  const positiveWidthSine = Math.fround(width * sine);
  const negativeHeightCosine = -height * cosine;
  const positiveHeightSine = height * sine;
  const positiveHeightCosine = height * cosine;
  result[0][0] = Math.fround(negativeWidthCosine - negativeHeightSine + x);
  result[0][1] = Math.fround(negativeWidthSine + negativeHeightCosine + y);
  result[1][0] = Math.fround(width * cosine - negativeHeightSine + x);
  result[1][1] = Math.fround(width * sine + negativeHeightCosine + y);
  result[2][0] = Math.fround(positiveWidthCosine - positiveHeightSine + x);
  result[2][1] = Math.fround(positiveWidthSine + positiveHeightCosine + y);
  result[3][0] = Math.fround(negativeWidthCosine - positiveHeightSine + x);
  result[3][1] = Math.fround(negativeWidthSine + positiveHeightCosine + y);
  for (let index = 0; index < 4; index++) result[index][2] = z;
}
