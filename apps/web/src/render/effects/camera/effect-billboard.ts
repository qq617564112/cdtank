import type {EffectVec3} from '../common/types';

/** Original billboard branch 0x481b62–0x481c38, in native camera space. */
export function effectBillboardCorners(center: EffectVec3, halfSize: EffectVec3,
  angleDegrees: number): [EffectVec3, EffectVec3, EffectVec3, EffectVec3] {
  const [x, y, z] = center.map(Math.fround);
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
  return [
    [Math.fround(negativeWidthCosine - negativeHeightSine + x),
      Math.fround(negativeWidthSine + negativeHeightCosine + y), z],
    [Math.fround(width * cosine - negativeHeightSine + x),
      Math.fround(width * sine + negativeHeightCosine + y), z],
    [Math.fround(positiveWidthCosine - positiveHeightSine + x),
      Math.fround(positiveWidthSine + positiveHeightCosine + y), z],
    [Math.fround(negativeWidthCosine - positiveHeightSine + x),
      Math.fround(negativeWidthSine + positiveHeightCosine + y), z],
  ];
}
