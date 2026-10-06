import {EffectNativeMatrix, normalizeEffectVector, transformEffectPositionInPlace} from '../common/effect-native-space';
import {EffectVec3} from '../common/types';
import type {EffectStripVertex} from '../common/effect-quad';

/** Type2 0x47d56e and gbDynVertBuf::RenderGeomQuadViaStrip 0x10025dc0. */
export function effectBoltDrawVertices(segments: readonly (readonly number[])[], matrix: EffectNativeMatrix,
  eye: EffectVec3, width: number, color: number): EffectStripVertex[] {
  const f = Math.fround;
  const vertices: EffectStripVertex[] = [];
  let previousLeft: EffectVec3 = [0, 0, 0], previousRight: EffectVec3 = [0, 0, 0];
  for (const [index, segment] of segments.entries()) {
    const start = transformEffectPositionInPlace(matrix, segment.slice(0, 3) as EffectVec3);
    const end = transformEffectPositionInPlace(matrix, segment.slice(3, 6) as EffectVec3);
    const direction = normalizeEffectVector(end.map((value, axis) => f(value - start[axis])) as EffectVec3);
    const towardEye = normalizeEffectVector(eye.map((value, axis) => f(value - start[axis])) as EffectVec3);
    const [x, y, z] = direction, [a, b, c] = towardEye;
    const side = [f(y * c - z * b), f(z * a - x * c), f(x * b - y * a)];
    let left = start.map((value, axis) => f(value + side[axis] * width)) as EffectVec3;
    let right = start.map((value, axis) => f(value - side[axis] * width)) as EffectVec3;
    if (index > 0) {
      left = left.map((value, axis) => f(f(value + previousLeft[axis]) * .5)) as EffectVec3;
      right = right.map((value, axis) => f(f(value + previousRight[axis]) * .5)) as EffectVec3;
    }
    vertices.push({position: left, uv: [index === 0 ? 0 : 1, 0], color},
      {position: right, uv: [index === 0 ? 0 : 1, 1], color});
    previousLeft = left;
    previousRight = right;
  }
  if (segments.length > 0) {
    vertices.push({position: previousLeft, uv: [1, 0], color},
      {position: previousRight, uv: [1, 1], color});
  }
  return vertices;
}

