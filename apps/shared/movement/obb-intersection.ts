/** Original gbengine OBB: three matrix rows, translation row, full dimensions. */
export interface RoleObb {
  readonly matrix: readonly number[];
  readonly dimensions: readonly [number, number, number];
}

/** Caller-owned result storage; collision inputs continue to use readonly RoleObb. */
export interface MutableRoleObb extends RoleObb {
  readonly matrix: number[];
  readonly dimensions: [number, number, number];
}

const f32 = Math.fround;

/** Matches the z + y + x evaluation order in gbengine 0x10032b50. */
function dotAxis(matrix: readonly number[], offset: number, x: number, y: number, z: number): number {
  return (f32(matrix[offset + 2]) * z + f32(matrix[offset + 1]) * y) + f32(matrix[offset]) * x;
}

function projectedRadius(box: RoleObb, x: number, y: number, z: number): number {
  const first = f32(Math.abs(dotAxis(box.matrix, 0, x, y, z)) * f32(box.dimensions[0]) * 0.5);
  const second = f32(first + Math.abs(dotAxis(box.matrix, 4, x, y, z)) * f32(box.dimensions[1]) * 0.5);
  return second + Math.abs(dotAxis(box.matrix, 8, x, y, z)) * f32(box.dimensions[2]) * 0.5;
}

/**
 * Recovered IsColOBB 0x10032ce0, including its inclusive face touching.
 * Cross-axis separation in the original branches to the success return; only
 * the six face-axis tests affect its result. Axes are used without normalization.
 */
export function intersectsOriginalObb(left: RoleObb, right: RoleObb): boolean {
  const dx = f32(f32(right.matrix[12]) - f32(left.matrix[12]));
  const dy = f32(f32(right.matrix[13]) - f32(left.matrix[13]));
  const dz = f32(f32(right.matrix[14]) - f32(left.matrix[14]));
  for (let index = 0; index < 3; index += 1) {
    const offset = index * 4;
    const lx = f32(left.matrix[offset]), ly = f32(left.matrix[offset + 1]), lz = f32(left.matrix[offset + 2]);
    const leftDistance = Math.abs(f32((lz * dz + ly * dy) + lx * dx));
    const leftRadius = f32(projectedRadius(right, lx, ly, lz) + f32(left.dimensions[index]) * 0.5);
    if (leftDistance > leftRadius) {
      return false;
    }
    const rx = f32(right.matrix[offset]), ry = f32(right.matrix[offset + 1]), rz = f32(right.matrix[offset + 2]);
    const rightDistance = Math.abs(f32((rz * dz + ry * dy) + rx * dx));
    const rightRadius = f32(projectedRadius(left, rx, ry, rz) + f32(right.dimensions[index]) * 0.5);
    if (rightDistance > rightRadius) {
      return false;
    }
  }
  return true;
}
