import {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';

export interface EffectTagFrame {
  readonly time: number;
  /** Original attachment data: position, quaternion and retained extra fields. */
  readonly matrix: readonly number[];
}

/** Complete gbengine 0x1000b800 attachment interpolation in native coordinates. */
export function sampleEffectTag(frames: readonly EffectTagFrame[], time: number): EffectNativeMatrix {
  const local = (time >>> 0) % frames[frames.length - 1].time;
  let index = 0;
  while (local >= frames[index + 1].time) ++index;
  const first = frames[index];
  const second = frames[index + 1];
  const fraction = (local - first.time) / (second.time - first.time);
  const t = Math.fround(fraction);
  const a = first.matrix.map(Math.fround);
  const b = second.matrix.map(Math.fround);
  const quaternion = interpolateQuaternion(a.slice(3, 7), b.slice(3, 7), t);
  quaternion[3] = -quaternion[3];
  const result = quaternionMatrix(quaternion);
  result[12] = Math.fround((1 - t) * a[0] + fraction * b[0]);
  result[13] = Math.fround(Math.fround((1 - t) * a[1]) + t * b[1]);
  result[14] = Math.fround(Math.fround((1 - t) * a[2]) + Math.fround(t * b[2]));
  return result;
}

function interpolateQuaternion(first: number[], second: number[], t: number): number[] {
  let dot = ((first[3] * second[3] + first[2] * second[2]) +
    first[0] * second[0]) + first[1] * second[1];
  if (dot < 0) {
    dot = -dot;
    second = second.map(value => -value);
  }
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
  return first.map((value, index) =>
    Math.fround(firstWeight * value + secondWeight * second[index]));
}

function quaternionMatrix(quaternion: number[]): number[] {
  const [x, y, z, w] = quaternion;
  const xx = 2 * x * x;
  const xy = 2 * x * y;
  const xz = Math.fround(2 * x * z);
  const xw = Math.fround(2 * x * w);
  const yy = Math.fround(2 * y * y);
  const yz = Math.fround(2 * y * z);
  const yw = Math.fround(2 * y * w);
  const zz = Math.fround(2 * z * z);
  const zw = 2 * z * w;
  return [Math.fround(1 - yy - zz), Math.fround(xy + zw), Math.fround(xz - yw), 0,
    Math.fround(xy - zw), Math.fround(1 - xx - zz), Math.fround(yz + xw), 0,
    Math.fround(yw + xz), Math.fround(yz - xw), Math.fround(1 - xx - yy), 0,
    0, 0, 0, 1];
}
