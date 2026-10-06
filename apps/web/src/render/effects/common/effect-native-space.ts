import {EffectVec3} from './types';

/** Original column-major gbMatrix4 memory, without Web X reflection. */
export type EffectNativeMatrix = readonly number[];

/** gbVec3D::Normalize uses original .005 threshold and +Y fallback. */
export function normalizeEffectVector(input: EffectVec3): EffectVec3 {
  const [x, y, z] = input.map(Math.fround);
  const length = Math.sqrt(x * x + y * y + z * z);
  if (length < Math.fround(.005)) return [0, 1, 0];
  const inverse = 1 / Math.fround(length);
  return [Math.fround(x * inverse), Math.fround(y * inverse), Math.fround(z * inverse)];
}

/** gbMatrix4::Rotate/RotateIn; translation does not participate. */
export function rotateEffectVector(matrix: EffectNativeMatrix, input: EffectVec3): EffectVec3 {
  const m = matrix.map(Math.fround);
  const [x, y, z] = input.map(Math.fround);
  return [Math.fround((m[4] * y + m[8] * z) + x * m[0]),
    Math.fround((m[1] * x + m[5] * y) + m[9] * z),
    Math.fround((m[2] * x + m[6] * y) + m[10] * z)];
}

/** gbMatrix4::Transform(vector, output), including translation. */
export function transformEffectPosition(matrix: EffectNativeMatrix, input: EffectVec3): EffectVec3 {
  const m = matrix.map(Math.fround);
  const [x, y, z] = input.map(Math.fround);
  return [Math.fround(((m[4] * y + m[8] * z) + x * m[0]) + m[12]),
    Math.fround(((m[1] * x + m[5] * y) + m[9] * z) + m[13]),
    Math.fround(((m[2] * x + m[6] * y) + m[10] * z) + m[14])];
}

/** gbMatrix4::Transform(vector, count=1), retaining its addition order. */
export function transformEffectPositionInPlace(matrix: EffectNativeMatrix, input: EffectVec3): EffectVec3 {
  const m = matrix.map(Math.fround);
  const [x, y, z] = input.map(Math.fround);
  return [Math.fround(((m[4] * y + m[8] * z) + x * m[0]) + m[12]),
    Math.fround(((m[1] * x + m[9] * z) + m[5] * y) + m[13]),
    Math.fround(((m[10] * z + m[2] * x) + m[6] * y) + m[14])];
}
