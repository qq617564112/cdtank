/** Original gbengine OBB: three matrix rows, translation row, full dimensions. */
export interface RoleObb {
  readonly matrix: readonly number[];
  readonly dimensions: readonly [number, number, number];
}

type Vector = readonly [number, number, number];
const f32 = Math.fround;

function axis(matrix: readonly number[], index: number): Vector {
  return [f32(matrix[index * 4]), f32(matrix[index * 4 + 1]), f32(matrix[index * 4 + 2])];
}

/** Matches the z + y + x evaluation order in gbengine 0x10032b50. */
function dot(left: Vector, right: Vector): number {
  return (left[2] * right[2] + left[1] * right[1]) + left[0] * right[0];
}

function projectedRadius(box: RoleObb, direction: Vector): number {
  const first = f32(Math.abs(dot(axis(box.matrix, 0), direction)) * f32(box.dimensions[0]) * 0.5);
  const second = f32(first + Math.abs(dot(axis(box.matrix, 1), direction)) * f32(box.dimensions[1]) * 0.5);
  return second + Math.abs(dot(axis(box.matrix, 2), direction)) * f32(box.dimensions[2]) * 0.5;
}

/**
 * Recovered IsColOBB 0x10032ce0, including its inclusive face touching.
 * Cross-axis separation in the original branches to the success return; only
 * the six face-axis tests affect its result. Axes are used without normalization.
 */
export function intersectsOriginalObb(left: RoleObb, right: RoleObb): boolean {
  const delta: Vector = [
    f32(f32(right.matrix[12]) - f32(left.matrix[12])),
    f32(f32(right.matrix[13]) - f32(left.matrix[13])),
    f32(f32(right.matrix[14]) - f32(left.matrix[14])),
  ];
  for (let index = 0; index < 3; index += 1) {
    const leftAxis = axis(left.matrix, index);
    const leftDistance = Math.abs(f32(dot(leftAxis, delta)));
    const leftRadius = f32(projectedRadius(right, leftAxis) + f32(left.dimensions[index]) * 0.5);
    if (leftDistance > leftRadius) {
      return false;
    }
    const rightAxis = axis(right.matrix, index);
    const rightDistance = Math.abs(f32(dot(rightAxis, delta)));
    const rightRadius = f32(projectedRadius(left, rightAxis) + f32(right.dimensions[index]) * 0.5);
    if (rightDistance > rightRadius) {
      return false;
    }
  }
  return true;
}
