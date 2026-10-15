import {EffectNativeMatrix, transformEffectPositionToRef} from './effect-native-space';
import {EffectVec3} from './types';

export const EFFECT_IDENTITY: EffectNativeMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const UNIT_SCALE: EffectVec3 = [1, 1, 1];

/** Per-draw matrix storage; the returned matrix lasts until the next update. */
export class EffectRenderTransform {
  private readonly first = [...EFFECT_IDENTITY];
  private readonly second = [...EFFECT_IDENTITY];
  private readonly operation = [...EFFECT_IDENTITY];
  private readonly rotations = new Float32Array(9);

  constructor() {
    // Each axis starts with angle zero, diagonal one and off-diagonal zero.
    this.rotations[1] = this.rotations[4] = this.rotations[7] = 1;
  }

  update(position: EffectVec3, orbit: EffectVec3, angles: EffectVec3,
    scale: EffectVec3, parent?: EffectNativeMatrix, global: EffectNativeMatrix = EFFECT_IDENTITY): number[] {
    let matrix = this.first;
    const base = parent ?? EFFECT_IDENTITY;
    for (let index = 0; index < 16; index++) matrix[index] = base[index];
    const operation = this.operation;
    this.resetOperation();
    for (let axis = 0; axis < 3; ++axis) operation[12 + axis] = Math.fround(position[axis] + orbit[axis]);
    matrix = this.multiply(matrix, operation);
    for (let axis = 0; axis < 3; ++axis) {
      const offset = axis * 3, angle = Math.fround(angles[axis]);
      if (!Object.is(this.rotations[offset], angle)) {
        const half = angle * Math.fround(.01745329238474369) * .5;
        const sine = Math.fround(Math.sin(Math.fround(half))), cosine = Math.fround(Math.cos(half));
        this.rotations[offset] = angle;
        this.rotations[offset + 1] = Math.fround(1 - 2 * sine * sine);
        this.rotations[offset + 2] = Math.fround(2 * sine * cosine);
      }
      const diagonal = this.rotations[offset + 1], offDiagonal = this.rotations[offset + 2];
      this.resetOperation();
      const first = (axis + 1) % 3, second = (axis + 2) % 3;
      operation[first * 4 + first] = diagonal; operation[second * 4 + second] = diagonal;
      operation[first * 4 + second] = offDiagonal; operation[second * 4 + first] = -offDiagonal;
      matrix = this.multiply(matrix, operation);
    }
    if (!parent) matrix = this.multiply(matrix, global);
    this.resetOperation();
    for (let axis = 0; axis < 3; axis++) operation[axis * 5] = Math.fround(scale[axis]);
    return this.multiply(matrix, operation);
  }

  private resetOperation(): void {
    for (let index = 0; index < 16; index++) this.operation[index] = EFFECT_IDENTITY[index];
  }

  private multiply(left: number[], right: EffectNativeMatrix): number[] {
    const result = left === this.first ? this.second : this.first;
    multiplyEffectMatricesToRef(left, right, result);
    return result;
  }
}

/** gbMatrixStack postmultiplies each translation, XYZ rotation and scale. */
export function effectRenderMatrix(position: EffectVec3, orbit: EffectVec3, angles: EffectVec3,
  scale: EffectVec3, parent?: EffectNativeMatrix, global: EffectNativeMatrix = EFFECT_IDENTITY): EffectNativeMatrix {
  return new EffectRenderTransform().update(position, orbit, angles, scale, parent, global);
}

export function multiplyEffectMatrices(left: EffectNativeMatrix, right: EffectNativeMatrix): number[] {
  const result = new Array<number>(16);
  multiplyEffectMatricesToRef(left, right, result);
  return result;
}

/** Output has its own storage; preserve the original float32 operation order. */
export function multiplyEffectMatricesToRef(left: EffectNativeMatrix, right: EffectNativeMatrix,
  result: number[]): void {
  for (let column = 0; column < 4; ++column) {
    for (let row = 0; row < 4; ++row) {
      result[column * 4 + row] = Math.fround(((left[row] * right[column * 4] +
        left[row + 4] * right[column * 4 + 1]) + left[row + 8] * right[column * 4 + 2]) +
        left[row + 12] * right[column * 4 + 3]);
    }
  }
}

export function effectOrientedCornersToRef(position: EffectVec3, orbit: EffectVec3, angles: EffectVec3,
  halfSize: EffectVec3, result: readonly [EffectVec3, EffectVec3, EffectVec3, EffectVec3],
  transform: EffectRenderTransform, parent?: EffectNativeMatrix, global?: EffectNativeMatrix): void {
  const matrix = transform.update(position, orbit, angles, UNIT_SCALE, parent, global);
  const [x, y] = halfSize;
  for (let index = 0; index < 4; index++) {
    const corner = result[index];
    corner[0] = index === 1 || index === 2 ? x : -x;
    corner[1] = index >= 2 ? y : -y;
    corner[2] = 0;
    transformEffectPositionToRef(matrix, corner, corner);
  }
}
