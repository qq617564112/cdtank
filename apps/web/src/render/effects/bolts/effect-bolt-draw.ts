import {EffectNativeMatrix, normalizeEffectVectorToRef, transformEffectPositionInPlaceToRef} from '../common/effect-native-space';
import {EffectVec3} from '../common/types';
import type {EffectStripVertex} from '../common/effect-quad';

export function effectBoltDrawVertices(segments: readonly (readonly number[])[],
  matrix: EffectNativeMatrix, eye: EffectVec3, width: number, color: number): EffectStripVertex[] {
  return new EffectBoltDrawState().update(segments, matrix, eye[0], eye[1], eye[2], width, color);
}

/** Type2 0x47d56e and gbDynVertBuf::RenderGeomQuadViaStrip 0x10025dc0. */
export class EffectBoltDrawState {
  private readonly vertices: EffectStripVertex[] = [];
  private readonly capacity: EffectStripVertex[] = [];
  private readonly start: EffectVec3 = [0, 0, 0];
  private readonly end: EffectVec3 = [0, 0, 0];
  private readonly direction: EffectVec3 = [0, 0, 0];
  private readonly towardEye: EffectVec3 = [0, 0, 0];
  private readonly side: EffectVec3 = [0, 0, 0];

  /** The sprite mesh copies all vertices before this instance is updated again. */
  update(segments: readonly (readonly number[])[], matrix: EffectNativeMatrix,
    eyeX: number, eyeY: number, eyeZ: number, width: number, color: number): EffectStripVertex[] {
    const f = Math.fround;
    const count = segments.length ? segments.length * 2 + 2 : 0;
    const vertices = this.vertices;
    for (let index = vertices.length; index < count; index++) {
      vertices[index] = this.capacity[index] ??= {position: [0, 0, 0], uv: [0, 0], color: 0};
    }
    vertices.length = count;
    const start = this.start, end = this.end, direction = this.direction;
    const towardEye = this.towardEye, side = this.side;
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      for (let axis = 0; axis < 3; axis++) {start[axis] = segment[axis]; end[axis] = segment[axis + 3];}
      transformEffectPositionInPlaceToRef(matrix, start, start);
      transformEffectPositionInPlaceToRef(matrix, end, end);
      for (let axis = 0; axis < 3; axis++) direction[axis] = f(end[axis] - start[axis]);
      towardEye[0] = f(eyeX - start[0]); towardEye[1] = f(eyeY - start[1]); towardEye[2] = f(eyeZ - start[2]);
      normalizeEffectVectorToRef(direction, direction); normalizeEffectVectorToRef(towardEye, towardEye);
      const [x, y, z] = direction, [a, b, c] = towardEye;
      side[0] = f(y * c - z * b); side[1] = f(z * a - x * c); side[2] = f(x * b - y * a);
      const left = vertices[index * 2], right = vertices[index * 2 + 1];
      for (let axis = 0; axis < 3; axis++) {
        const leftValue = f(start[axis] + side[axis] * width), rightValue = f(start[axis] - side[axis] * width);
        left.position[axis] = index > 0 ? f(f(leftValue + vertices[index * 2 - 2].position[axis]) * .5) : leftValue;
        right.position[axis] = index > 0 ? f(f(rightValue + vertices[index * 2 - 1].position[axis]) * .5) : rightValue;
      }
      left.uv[0] = right.uv[0] = index === 0 ? 0 : 1;
      left.uv[1] = 0; right.uv[1] = 1;
      left.color = right.color = color;
    }
    if (count) {
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const previous = vertices[count - 4 + sideIndex], tail = vertices[count - 2 + sideIndex];
        for (let axis = 0; axis < 3; axis++) tail.position[axis] = previous.position[axis];
        tail.uv[0] = 1; tail.uv[1] = sideIndex; tail.color = color;
      }
    }
    return vertices;
  }
}

