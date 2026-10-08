export interface AnimationTrack {
  readonly mode: number;
  readonly keys: readonly (readonly number[])[];
}

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
  const position = vector(transform.position, time);
  const rotation = quaternion(transform.rotation, time);
  const scale = vector(transform.scale, time);
  const scaleRotation = quaternion({...transform.scale,
    keys: transform.scale.keys.map(key => [key[0], key[1], ...key.slice(5, 9)])}, time);
  const uniform = new DataView(new ArrayBuffer(4));
  uniform.setUint32(0, transform.value, true);
  let matrix = [...ANIMATION_IDENTITY];
  matrix[12] = position[0];
  matrix[13] = position[1];
  matrix[14] = position[2];
  const amount = uniform.getFloat32(0, true);
  matrix = multiply(matrix, [amount, 0, 0, 0, 0, amount, 0, 0, 0, 0, amount, 0, 0, 0, 0, 1]);
  matrix = multiply(matrix, quaternionMatrix([rotation[0], rotation[1], rotation[2], -rotation[3]]));
  matrix = multiply(matrix, quaternionMatrix([scaleRotation[0], scaleRotation[1], scaleRotation[2], -scaleRotation[3]]));
  matrix = multiply(matrix, [scale[0], 0, 0, 0, 0, scale[1], 0, 0, 0, 0, scale[2], 0, 0, 0, 0, 1]);
  return multiply(matrix, quaternionMatrix(scaleRotation));
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

function interval(track: AnimationTrack, time: number): [readonly number[], readonly number[], number] {
  if (track.mode !== 3) throw new Error(`Unrecovered CVD track mode ${track.mode}`);
  if (track.keys.length === 0) throw new Error('CVD track contains no keys');
  const origin = track.keys[0][0];
  const last = track.keys[track.keys.length - 1];
  if (track.keys.length === 1 || time >= Math.fround(last[0] - origin)) return [last, last, 0];
  let index = 0;
  while (index + 1 < track.keys.length - 1
    && Math.fround(track.keys[index + 1][0] - origin) <= time) ++index;
  const first = track.keys[index], second = track.keys[index + 1];
  const start = Math.fround(first[0] - origin), end = Math.fround(second[0] - origin);
  return [first, second, (time - start) / (end - start)];
}

function vector(track: AnimationTrack, time: number): number[] {
  const [first, second, fraction] = interval(track, time);
  return [2, 3, 4].map(index => Math.fround((1 - fraction) * first[index] + fraction * second[index]));
}

function quaternion(track: AnimationTrack, time: number): number[] {
  const [first, second, rawFraction] = interval(track, time);
  const fraction = Math.fround(rawFraction);
  const left = first.slice(2, 6);
  let right = second.slice(2, 6);
  let dot = left[3] * right[3] + left[2] * right[2] + left[0] * right[0] + left[1] * right[1];
  if (dot < 0) {
    dot = -dot;
    right = right.map(value => -value);
  }
  let a = Math.fround(1 - fraction), b = fraction;
  if (1 - dot > .00001) {
    const degrees = Math.fround(Math.acos(dot) * Math.fround(57.2957763671875));
    const toRadians = Math.fround(.01745329238474369);
    const inverse = Math.fround(1 / Math.sin(degrees * toRadians));
    a = Math.fround(Math.sin((1 - fraction) * degrees * toRadians) * inverse);
    b = Math.sin(degrees * fraction * toRadians) * inverse;
  }
  return left.map((value, index) => Math.fround(a * value + b * right[index]));
}

function quaternionMatrix([x, y, z, w]: readonly number[]): number[] {
  const yy = Math.fround(2 * y * y), zz = Math.fround(2 * z * z), xz = Math.fround(2 * x * z);
  const xw = Math.fround(2 * x * w), yz = Math.fround(2 * y * z), yw = Math.fround(2 * y * w);
  const xy = 2 * x * y, xx = 2 * x * x, zw = 2 * z * w;
  return [Math.fround(1 - yy - zz), Math.fround(zw + xy), Math.fround(xz - yw), 0,
    Math.fround(xy - zw), Math.fround(1 - xx - zz), Math.fround(yz + xw), 0,
    Math.fround(yw + xz), Math.fround(yz - xw), Math.fround(1 - xx - yy), 0, 0, 0, 0, 1];
}

function multiply(left: readonly number[], right: readonly number[]): number[] {
  const result = new Array<number>(16);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    const value = ((left[row] * right[column * 4] + left[row + 4] * right[column * 4 + 1])
      + left[row + 8] * right[column * 4 + 2]) + left[row + 12] * right[column * 4 + 3];
    result[column * 4 + row] = Math.fround(value);
  }
  return result;
}
