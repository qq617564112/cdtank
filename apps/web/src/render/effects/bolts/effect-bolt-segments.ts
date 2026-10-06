import {EffectVec3} from '../common/types';

export interface EffectBoltConfig {
  start: EffectVec3;
  end: EffectVec3;
  lengthRange: readonly [number, number];
  angleRange: readonly [number, number];
}

export interface EffectBoltSegments {
  start: EffectVec3;
  end: EffectVec3;
  segments: EffectVec3[];
}

/** Type2 0x47dadc, with world endpoints and shared CRT random values supplied. */
export function generateEffectBoltSegments(config: EffectBoltConfig, origin: EffectVec3,
  random: () => number): EffectBoltSegments {
  const start = config.start.map((value, axis) => Math.fround(value + origin[axis])) as EffectVec3;
  const end = config.end.map((value, axis) => Math.fround(value + origin[axis])) as EffectVec3;
  const difference = end.map((value, axis) => Math.fround(value - start[axis]));
  const length = Math.fround(Math.sqrt(difference.reduce((sum, value) => sum + value * value, 0)));
  const segments: EffectVec3[] = [];
  const range = (minimum: number, maximum: number): number =>
    random() * Math.fround(maximum - minimum) * Math.fround(3.0518509447574615e-5) + minimum;
  let traveled = 0;
  let lateralY = 0;
  let lateralZ = 0;
  let remainder = 0;
  while (traveled < length && segments.length < 255) {
    const sampled = range(...config.lengthRange);
    const next = traveled + sampled;
    traveled = Math.fround(next);
    if (next >= length) {
      remainder = traveled - sampled;
      break;
    }
    const angleWidth = Math.fround(config.angleRange[1] - config.angleRange[0]);
    const angle = (): number => {
      const value = range(-angleWidth, angleWidth);
      return Math.fround(value < 0 ? value - config.angleRange[0] : value + config.angleRange[0]);
    };
    const yAngle = angle();
    const zAngle = angle();
    const sampledStored = Math.fround(sampled);
    let y = Math.fround(Math.sin(yAngle * Math.fround(.01745329238474369)) * sampledStored);
    let z = Math.sin(zAngle * Math.fround(.01745329238474369)) * sampledStored;
    if (!(length * .75 > traveled)) {
      if ((lateralY < 0) === (y < 0)) y = -y;
      if ((lateralZ < 0) === (z < 0)) z = -z;
    }
    segments.push([sampledStored, y, Math.fround(z)]);
    lateralY = Math.fround(lateralY + y);
    lateralZ = Math.fround(lateralZ + z);
    remainder = traveled;
  }
  segments.push([Math.fround(length - remainder), 0, 0]);
  return {start, end, segments};
}

/** Type2 segment transform built from native SetTwoVector and GetMatrix. */
export function effectBoltWorldSegments(bolt: EffectBoltSegments): number[][] {
  const direction = bolt.end.map((value, axis) => Math.fround(value - bolt.start[axis])) as EffectVec3;
  const length = Math.fround(Math.sqrt(direction.reduce((sum, value) => sum + value * value, 0)));
  const unit = length < Math.fround(.005) ? [0, 1, 0] :
    direction.map(value => Math.fround(value / length));
  const axis = normalizeBoltAxis([0, -unit[2], unit[1]]);
  const halfAngle = Math.acos(unit[0]) * Math.fround(57.2957763671875) * .5 *
    Math.fround(.01745329238474369);
  const sine = Math.sin(Math.fround(halfAngle));
  const [x, y, z] = axis.map(value => Math.fround(value * sine));
  const w = Math.fround(Math.cos(halfAngle));
  const xx = 2 * x * x, xy = 2 * x * y;
  const xz = Math.fround(2 * x * z), xw = Math.fround(2 * x * w);
  const yy = Math.fround(2 * y * y), yz = Math.fround(2 * y * z);
  const yw = Math.fround(2 * y * w), zz = Math.fround(2 * z * z), zw = 2 * z * w;
  const matrix = [Math.fround(1 - yy - zz), Math.fround(zw + xy), Math.fround(xz - yw), 0,
    Math.fround(xy - zw), Math.fround(1 - xx - zz), Math.fround(yz + xw), 0,
    Math.fround(yw + xz), Math.fround(yz - xw), Math.fround(1 - xx - yy), 0];
  const transform = ([a, b, c]: EffectVec3): EffectVec3 => {
    const offset = bolt.start;
    return [Math.fround(((a * matrix[0] + matrix[4] * b) + matrix[8] * c) + offset[0]),
      Math.fround(((matrix[1] * a + matrix[5] * b) + matrix[9] * c) + offset[1]),
      Math.fround(((matrix[2] * a + matrix[6] * b) + matrix[10] * c) + offset[2])];
  };
  let current: EffectVec3 = [0, 0, 0];
  return bolt.segments.map((segment, index) => {
    let displacement: EffectVec3 = [...segment];
    let next = current.map((value, axis) => Math.fround(value + segment[axis])) as EffectVec3;
    if (index === bolt.segments.length - 1) {
      next = [length, 0, 0];
      displacement = [Math.fround(Math.sqrt(direction.reduce((sum, value) => sum + value * value, 0)) - current[0]),
        -current[1], -current[2]];
    }
    const segmentLength = Math.fround(Math.sqrt(segment.reduce((sum, value) => sum + value * value, 0)));
    const normalized = normalizeBoltAxis(transform(displacement));
    const row = [...transform(current), ...transform(next), ...normalized, segmentLength];
    current = next;
    return row;
  });
}

function normalizeBoltAxis(input: EffectVec3): EffectVec3 {
  const length = Math.sqrt(input.reduce((sum, value) => sum + value * value, 0));
  if (length < Math.fround(.005)) return [0, 1, 0];
  const inverse = 1 / Math.fround(length);
  return input.map(value => Math.fround(value * inverse)) as EffectVec3;
}
