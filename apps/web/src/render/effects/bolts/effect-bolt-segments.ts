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
  const result: EffectBoltSegments = {start: [0, 0, 0], end: [0, 0, 0], segments: []};
  generateEffectBoltSegmentsToRef(config, origin, random, result, result.segments);
  return result;
}

/** Capacity belongs to the node; active segments remain a normal independent list. */
export function generateEffectBoltSegmentsToRef(config: EffectBoltConfig, origin: EffectVec3,
  random: () => number, result: EffectBoltSegments, capacity: EffectVec3[]): void {
  for (let axis = 0; axis < 3; axis++) {
    result.start[axis] = Math.fround(config.start[axis] + origin[axis]);
    result.end[axis] = Math.fround(config.end[axis] + origin[axis]);
  }
  const dx = Math.fround(result.end[0] - result.start[0]);
  const dy = Math.fround(result.end[1] - result.start[1]);
  const dz = Math.fround(result.end[2] - result.start[2]);
  const length = Math.fround(Math.sqrt(((0 + dx * dx) + dy * dy) + dz * dz));
  let traveled = 0;
  let lateralY = 0;
  let lateralZ = 0;
  let remainder = 0;
  let count = 0;
  while (traveled < length && count < 255) {
    const sampled = boltRange(random, config.lengthRange[0], config.lengthRange[1]);
    const next = traveled + sampled;
    traveled = Math.fround(next);
    if (next >= length) {
      remainder = traveled - sampled;
      break;
    }
    const angleWidth = Math.fround(config.angleRange[1] - config.angleRange[0]);
    const yAngle = boltAngle(random, angleWidth, config.angleRange[0]);
    const zAngle = boltAngle(random, angleWidth, config.angleRange[0]);
    const sampledStored = Math.fround(sampled);
    let y = Math.fround(Math.sin(yAngle * Math.fround(.01745329238474369)) * sampledStored);
    let z = Math.sin(zAngle * Math.fround(.01745329238474369)) * sampledStored;
    if (!(length * .75 > traveled)) {
      if ((lateralY < 0) === (y < 0)) y = -y;
      if ((lateralZ < 0) === (z < 0)) z = -z;
    }
    const segment = capacity[count] ??= [0, 0, 0];
    segment[0] = sampledStored; segment[1] = y; segment[2] = Math.fround(z);
    result.segments[count++] = segment;
    lateralY = Math.fround(lateralY + y);
    lateralZ = Math.fround(lateralZ + z);
    remainder = traveled;
  }
  const last = capacity[count] ??= [0, 0, 0];
  last[0] = Math.fround(length - remainder); last[1] = 0; last[2] = 0;
  result.segments[count++] = last;
  result.segments.length = count;
}

/** Type2 segment transform built from native SetTwoVector and GetMatrix. */
export function effectBoltWorldSegments(bolt: EffectBoltSegments): number[][] {
  const result: number[][] = [];
  effectBoltWorldSegmentsToRef(bolt, result, result);
  return result;
}

/** Write world rows into retained capacity, preserving native scalar operation order. */
export function effectBoltWorldSegmentsToRef(bolt: EffectBoltSegments, result: number[][],
  capacity: number[][]): void {
  const dx = Math.fround(bolt.end[0] - bolt.start[0]);
  const dy = Math.fround(bolt.end[1] - bolt.start[1]);
  const dz = Math.fround(bolt.end[2] - bolt.start[2]);
  const exactLength = Math.sqrt(((0 + dx * dx) + dy * dy) + dz * dz);
  const length = Math.fround(exactLength);
  const short = length < Math.fround(.005);
  const ux = short ? 0 : Math.fround(dx / length);
  const uy = short ? 1 : Math.fround(dy / length);
  const uz = short ? 0 : Math.fround(dz / length);
  const axisLength = Math.sqrt(((0 + 0 * 0) + -uz * -uz) + uy * uy);
  const shortAxis = axisLength < Math.fround(.005);
  const axisInverse = 1 / Math.fround(axisLength);
  const ax = 0;
  const ay = shortAxis ? 1 : Math.fround(-uz * axisInverse);
  const az = shortAxis ? 0 : Math.fround(uy * axisInverse);
  const halfAngle = Math.acos(ux) * Math.fround(57.2957763671875) * .5 *
    Math.fround(.01745329238474369);
  const sine = Math.sin(Math.fround(halfAngle));
  const x = Math.fround(ax * sine), y = Math.fround(ay * sine), z = Math.fround(az * sine);
  const w = Math.fround(Math.cos(halfAngle));
  const xx = 2 * x * x, xy = 2 * x * y;
  const xz = Math.fround(2 * x * z), xw = Math.fround(2 * x * w);
  const yy = Math.fround(2 * y * y), yz = Math.fround(2 * y * z);
  const yw = Math.fround(2 * y * w), zz = Math.fround(2 * z * z), zw = 2 * z * w;
  const m0 = Math.fround(1 - yy - zz), m1 = Math.fround(zw + xy), m2 = Math.fround(xz - yw);
  const m4 = Math.fround(xy - zw), m5 = Math.fround(1 - xx - zz), m6 = Math.fround(yz + xw);
  const m8 = Math.fround(yw + xz), m9 = Math.fround(yz - xw), m10 = Math.fround(1 - xx - yy);
  const offset = bolt.start;
  let currentX = 0, currentY = 0, currentZ = 0;
  for (let index = 0; index < bolt.segments.length; index++) {
    const segment = bolt.segments[index];
    let a = segment[0], b = segment[1], c = segment[2];
    let nextX = Math.fround(currentX + a), nextY = Math.fround(currentY + b), nextZ = Math.fround(currentZ + c);
    if (index === bolt.segments.length - 1) {
      nextX = length; nextY = 0; nextZ = 0;
      a = Math.fround(exactLength - currentX); b = -currentY; c = -currentZ;
    }
    const segmentLength = Math.fround(Math.sqrt(((0 + segment[0] * segment[0]) + segment[1] * segment[1]) + segment[2] * segment[2]));
    const nx = Math.fround(((a * m0 + m4 * b) + m8 * c) + offset[0]);
    const ny = Math.fround(((m1 * a + m5 * b) + m9 * c) + offset[1]);
    const nz = Math.fround(((m2 * a + m6 * b) + m10 * c) + offset[2]);
    const normalLength = Math.sqrt(((0 + nx * nx) + ny * ny) + nz * nz);
    const shortNormal = normalLength < Math.fround(.005);
    const inverse = 1 / Math.fround(normalLength);
    const row = capacity[index] ??= new Array<number>(10);
    row[0] = Math.fround(((currentX * m0 + m4 * currentY) + m8 * currentZ) + offset[0]);
    row[1] = Math.fround(((m1 * currentX + m5 * currentY) + m9 * currentZ) + offset[1]);
    row[2] = Math.fround(((m2 * currentX + m6 * currentY) + m10 * currentZ) + offset[2]);
    row[3] = Math.fround(((nextX * m0 + m4 * nextY) + m8 * nextZ) + offset[0]);
    row[4] = Math.fround(((m1 * nextX + m5 * nextY) + m9 * nextZ) + offset[1]);
    row[5] = Math.fround(((m2 * nextX + m6 * nextY) + m10 * nextZ) + offset[2]);
    row[6] = shortNormal ? 0 : Math.fround(nx * inverse);
    row[7] = shortNormal ? 1 : Math.fround(ny * inverse);
    row[8] = shortNormal ? 0 : Math.fround(nz * inverse);
    row[9] = segmentLength;
    result[index] = row;
    currentX = nextX; currentY = nextY; currentZ = nextZ;
  }
  result.length = bolt.segments.length;
}

function boltRange(random: () => number, minimum: number, maximum: number): number {
  return random() * Math.fround(maximum - minimum) * Math.fround(3.0518509447574615e-5) + minimum;
}

function boltAngle(random: () => number, width: number, minimum: number): number {
  const value = boltRange(random, -width, width);
  return Math.fround(value < 0 ? value - minimum : value + minimum);
}
