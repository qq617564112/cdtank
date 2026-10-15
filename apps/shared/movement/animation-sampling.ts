export interface AnimationKeyTrack {
  readonly mode: number;
  readonly keys: readonly (readonly number[])[];
}

export interface PackedAnimationTrack {
  readonly mode: number;
  readonly values: Float32Array;
  readonly stride: number;
}

export type AnimationTrack = AnimationKeyTrack | PackedAnimationTrack;

export interface AnimationVertices {
  readonly frames: readonly (readonly (readonly number[])[])[];
  readonly times: readonly number[];
}

export interface AnimationTransform {
  readonly position: AnimationTrack;
  readonly rotation: AnimationTrack;
  readonly scale: AnimationTrack;
  readonly value: number;
}

export interface AnimationSample {
  readonly matrix: number[];
  readonly vertices?: readonly number[][];
}

export const ANIMATION_IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/**
 * gbGeomNode advances one f32 engine delta, loops only after the clock is
 * strictly beyond duration, and samples each node track at the resulting time.
 */
export function sampleAnimation(
  transform: AnimationTransform | undefined,
  vertices: AnimationVertices | undefined,
  duration: number,
  time: number,
): AnimationSample {
  const local = loopAnimationTime(time, duration);
  const matrix = transform ? animationMatrix(transform, local) : [...ANIMATION_IDENTITY];
  if (!vertices) return {matrix};
  return {matrix, vertices: sampleAnimationVertices(vertices, local)};
}

/** Original gbGeomNode subtracts duration only when the new clock is strictly greater. */
export function loopAnimationTime(time: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(time)) return time;
  let local = time;
  while (local > duration) local -= duration;
  return local;
}

export function animationMatrix(transform: AnimationTransform, time: number): number[] {
  return new AnimationTransformSampler(transform).sample(time);
}

interface AnimationInterval {
  first: ArrayLike<number>;
  second: ArrayLike<number>;
  firstOffset: number;
  secondOffset: number;
  fraction: number;
}

/** One immutable CVD transform with a live output matrix and retained sampling buffers. */
export class AnimationTransformSampler {
  readonly matrix = [...ANIMATION_IDENTITY];
  private readonly position = new Array<number>(3);
  private readonly rotation = new Array<number>(4);
  private readonly scale = new Array<number>(3);
  private readonly scaleRotation = new Array<number>(4);
  private readonly operand = new Array<number>(16);
  private readonly product = new Array<number>(16);
  private readonly interval: AnimationInterval = {
    first: ANIMATION_IDENTITY, second: ANIMATION_IDENTITY,
    firstOffset: 0, secondOffset: 0, fraction: 0,
  };
  private readonly uniform: number;
  private sampledTime: number | undefined;

  constructor(private readonly transform: AnimationTransform) {
    const value = new DataView(new ArrayBuffer(4));
    value.setUint32(0, transform.value, true);
    this.uniform = value.getFloat32(0, true);
  }

  /** The returned array belongs to this sampler and changes on the next sample. */
  sample(time: number): number[] {
    if (this.sampledTime === time) return this.matrix;
    const {transform, position, rotation, scale, scaleRotation, matrix, operand, product} = this;
    vectorToRef(transform.position, time, position, this.interval);
    quaternionToRef(transform.rotation, time, 0, rotation, this.interval);
    vectorToRef(transform.scale, time, scale, this.interval);
    // Scale tracks store their quaternion immediately after XYZ.
    quaternionIntervalToRef(this.interval, 3, scaleRotation);
    for (let index = 0; index < 16; ++index) matrix[index] = ANIMATION_IDENTITY[index];
    matrix[12] = position[0]; matrix[13] = position[1]; matrix[14] = position[2];
    scalingToRef(this.uniform, this.uniform, this.uniform, operand);
    multiplyToRef(matrix, operand, product);
    quaternionMatrixToRef(rotation, true, operand);
    multiplyToRef(product, operand, matrix);
    quaternionMatrixToRef(scaleRotation, true, operand);
    multiplyToRef(matrix, operand, product);
    scalingToRef(scale[0], scale[1], scale[2], operand);
    multiplyToRef(product, operand, matrix);
    quaternionMatrixToRef(scaleRotation, false, operand);
    multiplyToRef(matrix, operand, product);
    for (let index = 0; index < 16; ++index) matrix[index] = product[index];
    this.sampledTime = time;
    return matrix;
  }
}

export function sampleAnimationVertices(animation: AnimationVertices, time: number): number[][] {
  if (animation.frames.length === 0) return [];
  const local = time;
  const times = animation.times;
  let index = 0;
  while (index + 1 < times.length - 1 && times[index + 1] <= local) ++index;
  if (index + 1 >= times.length || local >= times[times.length - 1]) {
    return animation.frames[animation.frames.length - 1].map(vertex => [...vertex.slice(5, 8), ...vertex.slice(2, 5), ...vertex.slice(0, 2)]);
  }
  const first = animation.frames[index], second = animation.frames[index + 1];
  const start = times[index], end = times[index + 1];
  const fraction = Math.fround((local - start) / (end - start));
  const inverse = Math.fround(1 - fraction);
  return first.map((vertex, at) => {
    const next = second[at];
    const mix = (axis: number): number => Math.fround(inverse * vertex[axis] + fraction * next[axis]);
    return [mix(5), mix(6), mix(7), ...next.slice(2, 5), mix(0), mix(1)];
  });
}

function intervalToRef(track: AnimationTrack, time: number, result: AnimationInterval): void {
  if (track.mode !== 3) throw new Error(`Unrecovered CVD track mode ${track.mode}`);
  const packed = 'values' in track;
  const count = packed ? track.values.length / track.stride : track.keys.length;
  if (count === 0) throw new Error('CVD track contains no keys');
  const origin = packed ? track.values[0] : track.keys[0][0];
  const lastIndex = count - 1;
  const lastTime = packed ? track.values[lastIndex * track.stride] : track.keys[lastIndex][0];
  if (count === 1 || time >= Math.fround(lastTime - origin)) {
    result.first = result.second = packed ? track.values : track.keys[lastIndex];
    result.firstOffset = result.secondOffset = packed ? lastIndex * track.stride + 1 : 2;
    result.fraction = 0;
    return;
  }
  let index = 0, high = count - 2;
  while (index < high) {
    const middle = Math.ceil((index + high) / 2);
    const middleTime = packed ? track.values[middle * track.stride] : track.keys[middle][0];
    if (Math.fround(middleTime - origin) <= time) index = middle;
    else high = middle - 1;
  }
  const firstTime = packed ? track.values[index * track.stride] : track.keys[index][0];
  const secondTime = packed ? track.values[(index + 1) * track.stride] : track.keys[index + 1][0];
  const start = Math.fround(firstTime - origin), end = Math.fround(secondTime - origin);
  result.first = packed ? track.values : track.keys[index];
  result.second = packed ? track.values : track.keys[index + 1];
  result.firstOffset = packed ? index * track.stride + 1 : 2;
  result.secondOffset = packed ? (index + 1) * track.stride + 1 : 2;
  result.fraction = (time - start) / (end - start);
}

function vectorToRef(track: AnimationTrack, time: number, result: number[], interval: AnimationInterval): void {
  intervalToRef(track, time, interval);
  const {first, second, firstOffset, secondOffset, fraction} = interval;
  for (let index = 0; index < 3; ++index) {
    result[index] = Math.fround((1 - fraction) * first[firstOffset + index]
      + fraction * second[secondOffset + index]);
  }
}

function quaternionToRef(track: AnimationTrack, time: number, offset: number,
  result: number[], interval: AnimationInterval): void {
  intervalToRef(track, time, interval);
  quaternionIntervalToRef(interval, offset, result);
}

function quaternionIntervalToRef(interval: AnimationInterval, offset: number, result: number[]): void {
  const {first, second} = interval;
  const firstOffset = interval.firstOffset + offset, secondOffset = interval.secondOffset + offset;
  const fraction = Math.fround(interval.fraction);
  let dot = first[firstOffset + 3] * second[secondOffset + 3] + first[firstOffset + 2] * second[secondOffset + 2]
    + first[firstOffset] * second[secondOffset] + first[firstOffset + 1] * second[secondOffset + 1];
  const negate = dot < 0;
  if (negate) dot = -dot;
  let a = Math.fround(1 - fraction), b = fraction;
  if (1 - dot > .00001) {
    const degrees = Math.fround(Math.acos(dot) * Math.fround(57.2957763671875));
    const toRadians = Math.fround(.01745329238474369);
    const inverse = Math.fround(1 / Math.sin(degrees * toRadians));
    a = Math.fround(Math.sin((1 - fraction) * degrees * toRadians) * inverse);
    b = Math.sin(degrees * fraction * toRadians) * inverse;
  }
  for (let index = 0; index < 4; ++index) {
    const right = negate ? -second[secondOffset + index] : second[secondOffset + index];
    result[index] = Math.fround(a * first[firstOffset + index] + b * right);
  }
}

function quaternionMatrixToRef(quaternion: readonly number[], negateW: boolean, result: number[]): void {
  const x = quaternion[0], y = quaternion[1], z = quaternion[2];
  const w = negateW ? -quaternion[3] : quaternion[3];
  const yy = Math.fround(2 * y * y), zz = Math.fround(2 * z * z), xz = Math.fround(2 * x * z);
  const xw = Math.fround(2 * x * w), yz = Math.fround(2 * y * z), yw = Math.fround(2 * y * w);
  const xy = 2 * x * y, xx = 2 * x * x, zw = 2 * z * w;
  result[0] = Math.fround(1 - yy - zz); result[1] = Math.fround(zw + xy); result[2] = Math.fround(xz - yw);
  result[3] = 0;
  result[4] = Math.fround(xy - zw); result[5] = Math.fround(1 - xx - zz); result[6] = Math.fround(yz + xw);
  result[7] = 0;
  result[8] = Math.fround(yw + xz); result[9] = Math.fround(yz - xw); result[10] = Math.fround(1 - xx - yy);
  result[11] = result[12] = result[13] = result[14] = 0;
  result[15] = 1;
}

function scalingToRef(x: number, y: number, z: number, result: number[]): void {
  result.fill(0);
  result[0] = x; result[5] = y; result[10] = z; result[15] = 1;
}

/** Result storage is separate from both operands. */
function multiplyToRef(left: readonly number[], right: readonly number[], result: number[]): void {
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    const value = ((left[row] * right[column * 4] + left[row + 4] * right[column * 4 + 1])
      + left[row + 8] * right[column * 4 + 2]) + left[row + 12] * right[column * 4 + 3];
    result[column * 4 + row] = Math.fround(value);
  }
}
