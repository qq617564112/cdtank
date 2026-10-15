import {EffectVec3} from './types';

/** Original column-major gbMatrix4 memory, without Web X reflection. */
export type EffectNativeMatrix = readonly number[];

/** gbVec3D::Normalize uses original .005 threshold and +Y fallback. */
export function normalizeEffectVector(input: EffectVec3): EffectVec3 {
  const result: EffectVec3 = [0, 0, 0];
  normalizeEffectVectorToRef(input, result);
  return result;
}

export function normalizeEffectVectorToRef(input: EffectVec3, result: EffectVec3): void {
  const x = Math.fround(input[0]), y = Math.fround(input[1]), z = Math.fround(input[2]);
  const length = Math.sqrt(x * x + y * y + z * z);
  if (length < Math.fround(.005)) {
    result[0] = 0; result[1] = 1; result[2] = 0;
    return;
  }
  const inverse = 1 / Math.fround(length);
  result[0] = Math.fround(x * inverse); result[1] = Math.fround(y * inverse); result[2] = Math.fround(z * inverse);
}

/** gbMatrix4::Rotate/RotateIn; translation does not participate. */
export function rotateEffectVector(matrix: EffectNativeMatrix, input: EffectVec3): EffectVec3 {
  const result: EffectVec3 = [0, 0, 0];
  rotateEffectVectorToRef(matrix, input, result);
  return result;
}

export function rotateEffectVectorToRef(matrix: EffectNativeMatrix, input: EffectVec3, result: EffectVec3): void {
  const x = Math.fround(input[0]), y = Math.fround(input[1]), z = Math.fround(input[2]);
  const m0 = Math.fround(matrix[0]), m4 = Math.fround(matrix[4]), m8 = Math.fround(matrix[8]);
  const m1 = Math.fround(matrix[1]), m5 = Math.fround(matrix[5]), m9 = Math.fround(matrix[9]);
  const m2 = Math.fround(matrix[2]), m6 = Math.fround(matrix[6]), m10 = Math.fround(matrix[10]);
  result[0] = Math.fround((m4 * y + m8 * z) + x * m0);
  result[1] = Math.fround((m1 * x + m5 * y) + m9 * z);
  result[2] = Math.fround((m2 * x + m6 * y) + m10 * z);
}

/** gbMatrix4::Transform(vector, output), including translation. */
export function transformEffectPosition(matrix: EffectNativeMatrix, input: EffectVec3): EffectVec3 {
  const result: EffectVec3 = [0, 0, 0];
  transformEffectPositionToRef(matrix, input, result);
  return result;
}

/** Output may reuse input storage; components are read before any writes. */
export function transformEffectPositionToRef(matrix: EffectNativeMatrix, input: Readonly<EffectVec3>,
  result: EffectVec3): void {
  const x = Math.fround(input[0]), y = Math.fround(input[1]), z = Math.fround(input[2]);
  const m0 = Math.fround(matrix[0]), m4 = Math.fround(matrix[4]), m8 = Math.fround(matrix[8]);
  const m1 = Math.fround(matrix[1]), m5 = Math.fround(matrix[5]), m9 = Math.fround(matrix[9]);
  const m2 = Math.fround(matrix[2]), m6 = Math.fround(matrix[6]), m10 = Math.fround(matrix[10]);
  result[0] = Math.fround(((m4 * y + m8 * z) + x * m0) + Math.fround(matrix[12]));
  result[1] = Math.fround(((m1 * x + m5 * y) + m9 * z) + Math.fround(matrix[13]));
  result[2] = Math.fround(((m2 * x + m6 * y) + m10 * z) + Math.fround(matrix[14]));
}

/** gbMatrix4::Transform(vector, count=1), retaining its addition order. */
export function transformEffectPositionInPlace(matrix: EffectNativeMatrix, input: EffectVec3): EffectVec3 {
  const result: EffectVec3 = [0, 0, 0];
  transformEffectPositionInPlaceToRef(matrix, input, result);
  return result;
}

/** Preserve the count=1 addition order, including when output reuses input. */
export function transformEffectPositionInPlaceToRef(matrix: EffectNativeMatrix, input: EffectVec3,
  result: EffectVec3): void {
  const x = Math.fround(input[0]), y = Math.fround(input[1]), z = Math.fround(input[2]);
  const m0 = Math.fround(matrix[0]), m4 = Math.fround(matrix[4]), m8 = Math.fround(matrix[8]);
  const m1 = Math.fround(matrix[1]), m5 = Math.fround(matrix[5]), m9 = Math.fround(matrix[9]);
  const m2 = Math.fround(matrix[2]), m6 = Math.fround(matrix[6]), m10 = Math.fround(matrix[10]);
  result[0] = Math.fround(((m4 * y + m8 * z) + x * m0) + Math.fround(matrix[12]));
  result[1] = Math.fround(((m1 * x + m9 * z) + m5 * y) + Math.fround(matrix[13]));
  result[2] = Math.fround(((m10 * z + m2 * x) + m6 * y) + Math.fround(matrix[14]));
}
