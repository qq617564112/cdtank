import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';
import {TANK_TAG_FRAME_SIZE, type TankTagTrack} from './tank-action-format';

export interface EffectTagFrame {
  readonly time: number;
  /** Original attachment data: position, quaternion and retained extra fields. */
  readonly matrix: readonly number[];
}

/** Complete gbengine 0x1000b800 attachment interpolation in native coordinates. */
export function sampleEffectTag(frames: readonly EffectTagFrame[], time: number): EffectNativeMatrix {
  const result = new Array<number>(16);
  sampleEffectTagToRef(frames, time, result);
  return result;
}

/** Sample into caller-owned storage without expanding frame or quaternion arrays. */
export function sampleEffectTagToRef(frames: readonly EffectTagFrame[], time: number, result: number[]): void {
  const local = (time >>> 0) % frames[frames.length - 1].time;
  let index = 0;
  while (local >= frames[index + 1].time) ++index;
  const first = frames[index];
  const second = frames[index + 1];
  const fraction = (local - first.time) / (second.time - first.time);
  interpolateTagToRef(first.matrix, 0, second.matrix, 0, fraction, result);
}

export function sampleEffectTagTrack(track: TankTagTrack, time: number): EffectNativeMatrix {
  const result = new Array<number>(16);
  sampleEffectTagTrackToRef(track, time, result);
  return result;
}

/** Read the packed source frames without creating frame or matrix views. */
export function sampleEffectTagTrackToRef(track: TankTagTrack, time: number, result: number[]): void {
  const data = track.data;
  const local = (time >>> 0) % data[(track.length - 1) * TANK_TAG_FRAME_SIZE];
  let index = 0;
  // Source times are ordered; keep the first interval as a single comparison.
  if (local >= data[TANK_TAG_FRAME_SIZE]) {
    index = 1;
    let end = track.length - 1;
    while (index + 1 < end) {
      const middle = (index + end) >>> 1;
      if (local >= data[middle * TANK_TAG_FRAME_SIZE]) index = middle;
      else end = middle;
    }
  }
  const first = index * TANK_TAG_FRAME_SIZE;
  const second = first + TANK_TAG_FRAME_SIZE;
  const fraction = (local - data[first]) / (data[second] - data[first]);
  interpolateTagToRef(data, first + 1, data, second + 1, fraction, result);
}

function interpolateTagToRef(a: ArrayLike<number>, firstOffset: number,
  b: ArrayLike<number>, secondOffset: number, fraction: number, result: number[]): void {
  const t = Math.fround(fraction);
  interpolateQuaternionToRef(a, firstOffset, b, secondOffset, t, result);
  result[3] = -result[3];
  quaternionMatrixToRef(result);
  result[12] = Math.fround((1 - t) * Math.fround(a[firstOffset]) + fraction * Math.fround(b[secondOffset]));
  result[13] = Math.fround(Math.fround((1 - t) * Math.fround(a[firstOffset + 1])) + t * Math.fround(b[secondOffset + 1]));
  result[14] = Math.fround(Math.fround((1 - t) * Math.fround(a[firstOffset + 2])) + Math.fround(t * Math.fround(b[secondOffset + 2])));
}

function interpolateQuaternionToRef(first: ArrayLike<number>, firstOffset: number,
  second: ArrayLike<number>, secondOffset: number, t: number,
  result: number[]): void {
  let dot = ((Math.fround(first[firstOffset + 6]) * Math.fround(second[secondOffset + 6]) +
    Math.fround(first[firstOffset + 5]) * Math.fround(second[secondOffset + 5])) +
    Math.fround(first[firstOffset + 3]) * Math.fround(second[secondOffset + 3])) +
    Math.fround(first[firstOffset + 4]) * Math.fround(second[secondOffset + 4]);
  const negate = dot < 0;
  if (negate) dot = -dot;
  let firstWeight: number;
  let secondWeight: number;
  if (1 - dot > .00001) {
    const radians = Math.fround(.01745329238474369);
    const angle = Math.acos(dot) * Math.fround(57.2957763671875);
    const storedAngle = Math.fround(angle);
    const inverse = Math.fround(1 / Math.sin(angle * radians));
    firstWeight = Math.fround(Math.sin((1 - t) * storedAngle * radians) * inverse);
    secondWeight = Math.sin(storedAngle * t * radians) * inverse;
  } else {
    firstWeight = Math.fround(1 - t);
    secondWeight = t;
  }
  for (let index = 0; index < 4; ++index) {
    const right = Math.fround(second[secondOffset + index + 3]);
    result[index] = Math.fround(firstWeight * Math.fround(first[firstOffset + index + 3]) + secondWeight * (negate ? -right : right));
  }
}

function quaternionMatrixToRef(result: number[]): void {
  const x = result[0], y = result[1], z = result[2], w = result[3];
  const xx = 2 * x * x;
  const xy = 2 * x * y;
  const xz = Math.fround(2 * x * z);
  const xw = Math.fround(2 * x * w);
  const yy = Math.fround(2 * y * y);
  const yz = Math.fround(2 * y * z);
  const yw = Math.fround(2 * y * w);
  const zz = Math.fround(2 * z * z);
  const zw = 2 * z * w;
  result[0] = Math.fround(1 - yy - zz); result[1] = Math.fround(xy + zw); result[2] = Math.fround(xz - yw);
  result[3] = 0;
  result[4] = Math.fround(xy - zw); result[5] = Math.fround(1 - xx - zz); result[6] = Math.fround(yz + xw);
  result[7] = 0;
  result[8] = Math.fround(yw + xz); result[9] = Math.fround(yz - xw); result[10] = Math.fround(1 - xx - yy);
  result[11] = result[12] = result[13] = result[14] = 0;
  result[15] = 1;
}
