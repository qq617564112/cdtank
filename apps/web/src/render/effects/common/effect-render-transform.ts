import {EffectNativeMatrix, transformEffectPosition} from './effect-native-space';
import {EffectVec3} from './types';

export const EFFECT_IDENTITY: EffectNativeMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** gbMatrixStack postmultiplies each translation, XYZ rotation and scale. */
export function effectRenderMatrix(position: EffectVec3, orbit: EffectVec3, angles: EffectVec3,
  scale: EffectVec3, parent?: EffectNativeMatrix, global: EffectNativeMatrix = EFFECT_IDENTITY): EffectNativeMatrix {
  let matrix = [...(parent ?? EFFECT_IDENTITY)];
  const translate = [...EFFECT_IDENTITY];
  for (let axis = 0; axis < 3; ++axis) translate[12 + axis] = Math.fround(position[axis] + orbit[axis]);
  matrix = multiplyEffectMatrices(matrix, translate);
  for (let axis = 0; axis < 3; ++axis) {
    const half = Math.fround(angles[axis]) * Math.fround(.01745329238474369) * .5;
    const sine = Math.fround(Math.sin(Math.fround(half))), cosine = Math.fround(Math.cos(half));
    const diagonal = Math.fround(1 - 2 * sine * sine), offDiagonal = Math.fround(2 * sine * cosine);
    const rotation = [...EFFECT_IDENTITY];
    const first = (axis + 1) % 3, second = (axis + 2) % 3;
    rotation[first * 4 + first] = diagonal; rotation[second * 4 + second] = diagonal;
    rotation[first * 4 + second] = offDiagonal; rotation[second * 4 + first] = -offDiagonal;
    matrix = multiplyEffectMatrices(matrix, rotation);
  }
  if (!parent) matrix = multiplyEffectMatrices(matrix, global);
  const scaling = [...EFFECT_IDENTITY];
  scale.forEach((value, axis) => {scaling[axis * 5] = Math.fround(value);});
  return multiplyEffectMatrices(matrix, scaling);
}

export function multiplyEffectMatrices(left: EffectNativeMatrix, right: EffectNativeMatrix): number[] {
  const result = new Array<number>(16);
  for (let column = 0; column < 4; ++column) {
    for (let row = 0; row < 4; ++row) {
      result[column * 4 + row] = Math.fround(((left[row] * right[column * 4] +
        left[row + 4] * right[column * 4 + 1]) + left[row + 8] * right[column * 4 + 2]) +
        left[row + 12] * right[column * 4 + 3]);
    }
  }
  return result;
}

export function effectOrientedCorners(position: EffectVec3, orbit: EffectVec3, angles: EffectVec3,
  halfSize: EffectVec3, parent?: EffectNativeMatrix, global?: EffectNativeMatrix): [EffectVec3, EffectVec3, EffectVec3, EffectVec3] {
  const matrix = effectRenderMatrix(position, orbit, angles, [1, 1, 1], parent, global);
  const [x, y] = halfSize;
  return [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0]].map(corner =>
    transformEffectPosition(matrix, corner as EffectVec3)) as [EffectVec3, EffectVec3, EffectVec3, EffectVec3];
}
